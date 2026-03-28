'use client';

import { useRouter } from 'next/navigation';
import React, { useEffect, useRef, useState } from 'react';
import { useTheme } from "@/hooks/useTheme";
import {
  LayoutDashboard,
  Trophy,
  Users,
  UserCircle,
  Settings,
  LogOut,
  ExternalLink,
  Upload,
  ChevronRight,
  FileText,
  Menu, // Іконка бургера
  X,    // Іконка закриття
  Home  // Іконка дому
} from 'lucide-react';

export default function DashboardPage() {
  const [isSidebarOpen, setIsSidebarOpen] = useState(false); // Стан для мобільного меню
  const revealRefs = useRef<(HTMLElement | null)[]>([]);
  const router = useRouter();
  const { dark } = useTheme();

  useEffect(() => {
    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            entry.target.classList.add("fuIn");
          }
        });
      },
      { threshold: 0.1 }
    );

function NavItem({ icon, label, active = false }: { icon: any, label: string, active?: boolean }) {
  return (
    <button className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-medium transition-all ${
      active
      ? 'bg-blue-600 text-white shadow-md'
      : 'text-slate-600 hover:bg-slate-100'
    }`}>
    {icon} <span>{label}</span>
    </button>
  );
}

// --- FILTER BUTTON COMPONENT ---
function FilterButton({ label, active = false }: { label: string, active?: boolean }) {
  return (
    <button className={`px-4 py-1.5 rounded-full text-xs font-bold transition-all ${
      active
      ? 'bg-blue-600 text-white shadow-sm'
      : 'bg-slate-100 text-slate-500 hover:bg-slate-200 border border-slate-200/50'
    }`}>
    {label}
    </button>
  );
}

// --- TOURNAMENT ROW COMPONENT ---
function TournamentRow({ title, status, statusType, date, participation, isSpecialAction }: any) {
  // Исправлено: имя объекта должно совпадать с тем, что используется в логике (statusStyles)
  const statusStyles = {
    warning: 'text-orange-600 bg-orange-50 border-orange-100',
    info: 'text-blue-600 bg-blue-50 border-blue-100',
    success: 'text-emerald-600 bg-emerald-50 border-emerald-100'
  };

  // Исправлено: обращаемся к statusStyles, а не к несуществующему statusColors
  const colors = statusStyles[statusType as keyof typeof statusStyles] || statusStyles.info;

  return (
    <tr className="hover:bg-slate-50/80 transition-colors group">
    <td className="px-6 py-5 font-bold text-slate-700 underline-offset-4 decoration-blue-200 group-hover:underline">
    {title}
    </td>
    <td className="px-6 py-5">
    <span className={`text-[10px] font-black uppercase px-2 py-1 rounded border ${colors}`}>
    {status}
    </span>
    </td>
    <td className="px-6 py-5 text-slate-500 font-medium">{date}</td>
    <td className="px-6 py-5 text-slate-700 font-medium">{participation}</td>
    <td className="px-6 py-5 text-right">
    {isSpecialAction ? (
      <button className="text-blue-600 font-black text-[10px] uppercase tracking-tighter hover:bg-blue-50 px-3 py-1.5 rounded-lg border border-blue-100 transition-all">
      Зареєструватись
      </button>
    ) : (
      <button className="p-2 text-slate-300 group-hover:text-blue-600 group-hover:bg-blue-50 rounded-lg transition-all">
      <ExternalLink size={18} />
      </button>
    )}
    </td>
    </tr>
  );
}

// --- ОСНОВНАЯ СТРАНИЦА ---

export default function HomePage() {
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);

  // Закриття сайдбару при зміні маршруту (на мобільних)
  const navigateTo = (path: string) => {
    setIsSidebarOpen(false);
    router.push(path);
  };

  return (
    <div className="flex min-h-screen overflow-x-hidden bg-(--bg) text-(--t1) transition-colors duration-300">
    <style jsx global>{`
      @keyframes fadeUp {
        from { opacity: 0; transform: translateY(20px); }
        to { opacity: 1; transform: none; }
      }
      @keyframes cardDrop {
        from { opacity: 0; transform: translateY(-26px) scale(0.97); }
        to { opacity: 1; transform: none; }
      }
      .fuIn { animation: fadeUp 340ms cubic-bezier(0.22, 1, 0.36, 1) both; }
      .cdIn { animation: cardDrop 500ms cubic-bezier(0.22, 1, 0.36, 1) both; }
      .spr { transition: transform 170ms cubic-bezier(0.22, 1, 0.36, 1), box-shadow 170ms ease, background 150ms ease, color 150ms ease; }
      .spr:hover { transform: translateY(-2px) scale(1.025); }
      `}</style>

      {/* --- MOBILE OVERLAY --- */}
      {isSidebarOpen && (
        <div
        className="fixed inset-0 bg-black/50 backdrop-blur-sm z-40 lg:hidden transition-opacity"
        onClick={() => setIsSidebarOpen(false)}
        />
      )}

      {/* --- SIDEBAR --- */}
      <aside className={`
        fixed inset-y-0 left-0 z-50 w-72 bg-(--card) border-r border-(--brd) flex flex-col transition-transform duration-300 ease-in-out
        lg:relative lg:translate-x-0
        ${isSidebarOpen ? 'translate-x-0' : '-translate-x-full'}
        `}>
        {/* Header сайдбару з профілем */}
        <button
        onClick={() => navigateTo('/profile')}
        className="p-6 flex items-center gap-3 w-full text-left transition-colors hover:bg-(--bg) group border-b border-(--brd)"
        >
        <div className="w-10 h-10 rounded-full flex items-center justify-center text-white font-bold text-sm spr shadow-sm bg-blue-600 flex-shrink-0">
        AP
        </div>
        <div className="overflow-hidden">
        <p className="text-sm font-bold text-(--t1) truncate">Anton Petrov</p>
        <p className="text-[10px] uppercase tracking-wider font-bold text-(--t2)">Admin Role</p>
        </div>
        </button>

        <nav className="flex-1 p-4 space-y-1">
        {/* Кнопка повернення на головну */}
        <button
        onClick={() => navigateTo('/')}
        className="w-full flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-bold transition-all spr text-(--t2) hover:bg-(--bg) hover:text-blue-600 mb-4 border border-(--brd) border-dashed"
        >
        <Home size={18} /> <span>На головну</span>
        </button>

        <NavItem icon={<LayoutDashboard size={18} />} label="Dashboard" active onClick={() => navigateTo('/main_page')} />
        <NavItem icon={<Trophy size={18} />} label="Турніри" onClick={() => {}} />
        <NavItem icon={<Users size={18} />} label="Команди" onClick={() => {}} />
        <NavItem icon={<UserCircle size={18} />} label="Гравці" onClick={() => {}} />
        <NavItem icon={<Settings size={18} />} label="Налаштування" onClick={() => {}} />
        </nav>

        <div className="p-4 mt-auto border-t border-(--brd)">
        <button className="flex items-center gap-3 px-4 py-2.5 w-full text-sm font-bold spr rounded-xl transition-colors text-(--t2) hover:text-red-500">
        <LogOut size={18} /> Вихід
        </button>
        </div>
        </aside>

        {/* --- MAIN CONTENT --- */}
        <main className="flex-1 flex flex-col min-w-0">
        {/* --- MOBILE TOP BAR --- */}
        <header className="lg:hidden p-4 flex items-center justify-between bg-(--card) border-b border-(--brd) sticky top-0 z-30">
        {/* Кнопка бургера тепер ЗЛІВА */}
        <button
        onClick={() => setIsSidebarOpen(true)}
        className="p-2 rounded-xl bg-(--bg) border border-(--brd) text-(--t1) active:scale-95 transition-transform"
        >
        <Menu size={24} />
        </button>

        {/* Логотип по центру (опціонально) або назва */}
        <div className="flex items-center gap-2">
        <div className="w-7 h-7 bg-blue-600 rounded-lg flex items-center justify-center text-white">
        <Trophy size={16} />
        </div>
        <span className="font-black text-xs uppercase tracking-tighter">Code Future</span>
        </div>

        {/* Аватарка акаунта тепер СПРАВА */}
        <button
        onClick={() => navigateTo('/profile')}
        className="flex-shrink-0 active:scale-95 transition-transform"
        >
        <div className="w-10 h-10 rounded-full flex items-center justify-center text-white font-bold text-xs shadow-sm bg-blue-600 border-2 border-(--brd)">
        AP
        </div>
        </button>
        </header>

        <div className="p-6 md:p-8 lg:p-12 overflow-y-auto">
        <header className="mb-12">
        <div className="flex items-center gap-2 text-[10px] font-black mb-3 uppercase tracking-widest text-(--t2)">
        <button onClick={() => router.push('/')} className="hover:text-blue-600 transition-colors">Головна</button>
        <ChevronRight size={10} />
        <span className="text-(--t1)">Дашборд</span>
        </div>
        <h1 className="text-2xl md:text-3xl font-black tracking-tight text-(--t1) uppercase">
        Огляд кабінету
        </h1>
        </header>

        <div className="max-w-6xl space-y-8">
        {/* 1. СПИСОК ТУРНІРІВ */}
        <section
        ref={(el) => { revealRefs.current[0] = el; }}
        className="cdIn opacity-0 rounded-[2.5rem] overflow-hidden bg-(--card) border border-(--brd) shadow-xl"
        >
        <div className="p-6 md:p-8 flex flex-col md:flex-row md:items-center justify-between gap-6 border-b border-(--brd)">
        <h2 className="font-black text-xl text-(--t1) uppercase tracking-tight flex items-center gap-2">
        🏆 <span className="hidden sm:inline">Список</span> турнірів
        </h2>
        <div className="flex flex-wrap gap-2">
        <FilterButton label="Всі" active />
        <FilterButton label="Open" />
        <FilterButton label="Running" />
        </div>
        </div>

        <div className="overflow-x-auto">
        <table className="w-full text-left border-collapse min-w-[600px]">
        <thead>
        <tr className="bg-(--bg)/50 border-b border-(--brd)">
        <th className="px-8 py-4 text-[10px] font-black uppercase tracking-widest text-(--t2)">Турнір</th>
        <th className="px-8 py-4 text-[10px] font-black uppercase tracking-widest text-(--t2)">Статус</th>
        <th className="px-8 py-4 text-[10px] font-black uppercase tracking-widest text-(--t2)">Старт</th>
        <th className="px-8 py-4 text-[10px] font-black uppercase tracking-widest text-right text-(--t2)">Дії</th>
        </tr>
        </thead>
        <tbody className="text-sm divide-y divide-(--brd)">
        <TournamentRow title="Хакатон 2026" status="Running" statusType="warning" date="12.01.2026" />
        <TournamentRow title="Summer Jam" status="Open" statusType="info" date="02.01.2026" isSpecialAction />
        </tbody>
        </table>
        </div>
        </section>

        {/* 2. КОМАНДА */}
        <section
        ref={(el) => { revealRefs.current[1] = el; }}
        className="cdIn opacity-0 rounded-[2.5rem] p-6 md:p-8 relative overflow-hidden bg-(--card) border border-(--brd) shadow-xl"
        >
        <div className="absolute -right-12 -top-12 w-40 h-40 rounded-full blur-3xl opacity-10 bg-blue-600" />
        <h2 className="font-black text-xl mb-8 flex items-center gap-3 relative z-10 text-(--t1) uppercase tracking-tight">
        <Users className="text-blue-600" size={24} /> Team Alpha
        </h2>

        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4 md:gap-6 relative z-10">
        <div className="p-6 rounded-2xl bg-(--bg) border border-(--brd)">
        <p className="text-[10px] font-black uppercase tracking-wider mb-2 text-(--t2)">Поточний турнір</p>
        <p className="font-bold text-sm text-(--t1)">Весняний хакатон</p>
        </div>
        <div className="p-6 rounded-2xl bg-(--bg) border border-(--brd)">
        <p className="text-[10px] font-black uppercase tracking-wider mb-2 text-(--t2)">Завдання</p>
        <p className="font-bold text-sm text-(--t1)">API Auth System</p>
        </div>
        <div className="p-6 rounded-2xl bg-blue-600/10 border border-blue-600/20">
        <p className="text-[10px] font-black uppercase tracking-wider mb-2 text-blue-600">Статус</p>
        <p className="font-bold text-sm text-blue-600 italic">v2_final.zip</p>
        </div>
        </div>

        <div className="mt-8 flex flex-col sm:flex-row items-center justify-between gap-6 pt-8 border-t border-(--brd)">
        <p className="text-xs font-bold text-(--t2) uppercase tracking-widest italic text-center sm:text-left">
        Статус: Перевірка...
        </p>
        <button className="w-full sm:w-auto bg-blue-600 text-white font-black text-xs uppercase tracking-widest rounded-2xl px-8 py-4 flex items-center justify-center gap-2 hover:bg-blue-700 shadow-lg shadow-blue-600/20 active:scale-95 transition-all">
        <Upload size={16} /> Нова версія
        </button>
        </div>
        </section>
        </div>
        </div>
        </main>
        </div>
  );
}

function NavItem({ icon, label, active = false, onClick }: { icon: any, label: string, active?: boolean, onClick: () => void }) {
  return (
    <button
    onClick={onClick}
    className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-bold transition-all spr ${active ? 'bg-blue-600 text-white shadow-lg shadow-blue-600/20' : 'text-(--t2) hover:bg-(--bg) hover:text-blue-600'}`}
    >
    {icon} <span>{label}</span>
    </button>
  );
}

function FilterButton({ label, active = false }: { label: string, active?: boolean }) {
  return (
    <button className={`px-4 py-2 rounded-full text-[10px] font-black uppercase tracking-widest transition-all spr ${active ? 'bg-blue-600 text-white shadow-md' : 'bg-(--bg) text-(--t2) border border-(--brd)'}`}>
    {label}
    </button>
  );
}

function TournamentRow({ title, status, statusType, date, isSpecialAction }: any) {
  const colors = {
    warning: "bg-amber-500/10 text-amber-600 border-amber-500/30",
    info: "bg-blue-600/10 text-blue-600 border-blue-600/30"
  }[statusType as 'warning' | 'info'] || "bg-blue-600/10 text-blue-600 border-blue-600/30";

  return (
    <tr className="group transition-colors hover:bg-(--bg)/30">
    <td className="px-8 py-5 font-bold text-(--t1)">{title}</td>
    <td className="px-8 py-5">
    <span className={`text-[9px] font-black uppercase px-2.5 py-1.5 rounded border ${colors}`}>
    {status}
    </span>
    </td>
    <td className="px-8 py-5 font-bold text-(--t2) text-xs">{date}</td>
    <td className="px-8 py-5 text-right">
    {isSpecialAction ? (
      <button className="font-black text-[9px] uppercase tracking-tighter px-3 py-2 rounded-lg border border-blue-600 bg-blue-600/10 text-blue-600 hover:bg-blue-600 hover:text-white transition-all">
      Реєстрація
      </button>
    ) : (
      <button className="p-2 rounded-lg text-(--t2) hover:bg-blue-600/10 hover:text-blue-600 transition-colors">
      <ExternalLink size={16} />
      </button>
    )}
    </td>
    </tr>
  );
}
