'use client';

import React, { useState } from 'react';
import Link from 'next/link';
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
  Menu,
  X
} from 'lucide-react';

// --- ВСПОМОГАТЕЛЬНЫЕ КОМПОНЕНТЫ ---

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

function TournamentRow({ title, status, statusType, date, participation, isSpecialAction }: any) {
  const statusStyles = {
    warning: 'text-orange-600 bg-orange-50 border-orange-100',
    info: 'text-blue-600 bg-blue-50 border-blue-100',
    success: 'text-emerald-600 bg-emerald-50 border-emerald-100'
  };

  return (
    <tr className="hover:bg-slate-50/80 transition-colors group">
    <td className="px-6 py-5 font-bold text-slate-700 underline-offset-4 decoration-blue-200 group-hover:underline">{title}</td>
    <td className="px-6 py-5">
    <span className={`text-[10px] font-black uppercase px-2 py-1 rounded border ${statusStyles[statusType as keyof typeof statusStyles]}`}>
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

  return (
    <div className="flex min-h-screen bg-[#F1F3F5] text-slate-900 relative overflow-x-hidden">

    {/* --- СИСТЕМА ФОНА (Фиксированный щит) --- */}
    <div className="fixed inset-0 flex items-center justify-center z-0 pointer-events-none opacity-[0.04]">
    <img
    src="/logo_backround1.svg"
    alt="Background Watermark"
    className="w-[1000px] h-[1000px] object-contain"
    />
    </div>

    {/* Overlay для мобилок */}
    {isSidebarOpen && (
      <div
      className="fixed inset-0 bg-slate-900/40 z-40 lg:hidden backdrop-blur-sm"
      onClick={() => setIsSidebarOpen(false)}
      />
    )}

    {/* Sidebar */}
    <aside className={`
      fixed inset-y-0 left-0 z-50 w-64 bg-white/90 backdrop-blur-md text-slate-900 flex flex-col shrink-0 transition-transform duration-300 ease-in-out border-r border-slate-100
      lg:relative lg:translate-x-0
      ${isSidebarOpen ? 'translate-x-0' : '-translate-x-full'}
      `}>
      <div className="p-6 border-b border-slate-100">
      <div className="flex items-center justify-between">
      <Link href="/profile" className="flex items-center gap-3 group cursor-pointer active:opacity-70">
      <div className="w-10 h-10 bg-blue-600 rounded-full flex items-center justify-center text-white shadow font-bold group-hover:scale-105 transition-transform">
      AP
      </div>
      <div className="overflow-hidden">
      <p className="text-sm font-bold truncate group-hover:text-blue-600 transition-colors">Anton Petrov</p>
      <p className="text-[10px] text-slate-400 uppercase tracking-wider">Admin Role</p>
      </div>
      </Link>
      <button onClick={() => setIsSidebarOpen(false)} className="lg:hidden text-slate-400 hover:text-slate-900">
      <X size={20} />
      </button>
      </div>
      </div>

      <nav className="flex-1 p-4 space-y-1">
      <NavItem icon={<LayoutDashboard size={18} />} label="Dashboard" active />
      <NavItem icon={<Trophy size={18} />} label="Турніри" />
      <NavItem icon={<Users size={18} />} label="Команди" />
      <NavItem icon={<UserCircle size={18} />} label="Гравці" />
      <NavItem icon={<Settings size={18} />} label="Налаштування" />
      </nav>

      <div className="p-4 mt-auto border-t border-slate-100">
      <button className="flex items-center gap-3 px-4 py-2 hover:text-red-600 transition-colors w-full text-sm font-medium text-slate-600">
      <LogOut size={18} /> Вихід
      </button>
      </div>
      </aside>

      {/* Main Content Area - Z-10 чтобы быть выше фона */}
      <main className="flex-1 p-4 md:p-8 overflow-y-auto relative z-10">
      <header className="mb-8">
      {/* Mobile Header */}
      <div className="flex lg:hidden items-center justify-between mb-6 p-1 bg-white/80 backdrop-blur-md border border-slate-100 rounded-2xl shadow-sm">
      <button onClick={() => setIsSidebarOpen(true)} className="p-3 text-slate-600 rounded-xl hover:bg-slate-50">
      <Menu size={24} />
      </button>
      <Link href="/profile" className="flex items-center gap-2 pr-3 active:scale-95 transition-transform">
      <div className="text-[10px] font-black text-slate-500 uppercase">Anton Petrov</div>
      <div className="w-8 h-8 bg-blue-600 rounded-full flex items-center justify-center text-white text-xs font-bold shadow-sm">AP</div>
      </Link>
      </div>

      <div className="flex items-center gap-2 text-xs text-slate-400 mb-2 font-medium">
      <span>Головна</span>
      <ChevronRight size={12} />
      <span className="text-slate-600">Дашборд</span>
      </div>
      <h1 className="text-2xl font-black text-slate-900 tracking-tight">8. Головна сторінка - Огляд</h1>
      </header>

      <div className="max-w-6xl space-y-8">
      {/* Секция турниров с эффектом стекла */}
      <section className="bg-white/90 backdrop-blur-sm rounded-2xl shadow-sm border border-slate-100 overflow-hidden">
      <div className="p-6 border-b border-slate-100 flex flex-col md:flex-row md:items-center justify-between gap-4">
      <div className="flex items-center gap-2">
      <Trophy className="text-blue-600" size={20} />
      <h2 className="font-bold text-lg text-slate-800">1. Список турнірів</h2>
      </div>
      <div className="flex flex-wrap gap-2">
      <FilterButton label="Всі" active />
      <FilterButton label="Registration Open" />
      <FilterButton label="Running" />
      </div>
      </div>

      <div className="overflow-x-auto">
      <table className="w-full text-left border-collapse min-w-[600px]">
      <thead>
      <tr className="bg-slate-50/50 text-[10px] font-bold text-slate-400 uppercase tracking-widest border-b border-slate-100">
      <th className="px-6 py-4">Назва турніру</th>
      <th className="px-6 py-4">Статус</th>
      <th className="px-6 py-4">Дата старту</th>
      <th className="px-6 py-4">Ваша участь</th>
      <th className="px-6 py-4 text-right">Дії</th>
      </tr>
      </thead>
      <tbody className="text-sm divide-y divide-slate-50">
      <TournamentRow
      title="Весняний хакатон 2026"
      status="Running"
      statusType="warning"
      date="12.01.2026"
      participation="Дати"
      />
      <TournamentRow
      title="Summer Code Jam"
      status="Registration"
      statusType="info"
      date="02.01.2026"
      participation="—"
      isSpecialAction
      />
      </tbody>
      </table>
      </div>
      </section>

      {/* Секция команды с эффектом стекла */}
      <section className="bg-white/90 backdrop-blur-sm rounded-2xl shadow-sm border border-slate-100 p-6 relative overflow-hidden">
      <div className="absolute -right-8 -top-8 w-32 h-32 bg-blue-50 rounded-full blur-3xl opacity-60" />
      <h2 className="font-bold text-lg text-slate-800 mb-6 flex items-center gap-2">
      <Users className="text-blue-600" size={20} /> 2. Команда: Team Alpha
      </h2>
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 relative z-10">
      <div className="p-4 rounded-xl bg-slate-50/80 border border-slate-100 backdrop-blur-sm">
      <p className="text-[10px] font-bold text-slate-400 uppercase mb-1">Поточний турнір</p>
      <div className="flex items-center justify-between">
      <a href="#" className="font-bold text-slate-900 hover:text-blue-600 transition-colors flex items-center gap-1.5">
      Весняний хакатон 2026 <ExternalLink size={14} />
      </a>
      <span className="text-[9px] font-black uppercase px-1.5 py-0.5 rounded bg-orange-100 text-orange-600 border border-orange-200">Running</span>
      </div>
      </div>
      <div className="p-4 rounded-xl bg-slate-50/80 border border-slate-100 backdrop-blur-sm">
      <p className="text-[10px] font-bold text-slate-400 uppercase mb-1">Ваше завдання</p>
      <p className="font-semibold text-slate-800">Створення API для авторизації</p>
      </div>
      <div className="p-4 rounded-xl bg-blue-50/50 border border-blue-100 backdrop-blur-sm">
      <p className="text-[10px] font-bold text-blue-400 uppercase mb-1">Останній сабміт</p>
      <div className="flex items-center gap-2 text-blue-700">
      <FileText size={16} />
      <p className="text-sm font-bold italic">v2_final_build.zip</p>
      </div>
      </div>
      </div>
      </section>
      </div>
      </main>
      </div>
  );
}
