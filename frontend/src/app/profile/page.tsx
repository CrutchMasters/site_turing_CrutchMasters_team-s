"use client";

import React, { useState } from 'react';
import { useRouter } from 'next/navigation';
import {
  User, Mail, Shield, Users, History,
  CheckCircle, Clock, XCircle, Edit2,
  Menu, Home, LayoutDashboard, Trophy,
  UserCircle, Settings, LogOut, ChevronRight
} from 'lucide-react';
import { useTheme } from "@/hooks/useTheme";

export default function UserProfile() {
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const { dark } = useTheme();
  const router = useRouter();

  const navigateTo = (path: string) => {
    setIsSidebarOpen(false);
    router.push(path);
  };

  return (
    <div className="flex min-h-screen bg-(--bg) text-(--t1) transition-colors duration-300">

    {/* --- MOBILE OVERLAY --- */}
    {isSidebarOpen && (
      <div
      className="fixed inset-0 bg-black/50 backdrop-blur-sm z-40 lg:hidden"
      onClick={() => setIsSidebarOpen(false)}
      />
    )}

    {/* --- SIDEBAR (Адаптивний) --- */}
    <aside className={`
      fixed inset-y-0 left-0 z-50 w-72 bg-(--card) border-r border-(--brd) flex flex-col transition-transform duration-300 ease-in-out
      lg:relative lg:translate-x-0
      ${isSidebarOpen ? 'translate-x-0' : '-translate-x-full'}
      `}>
      <div className="p-6 border-b border-(--brd) flex items-center gap-3">
      <div className="w-8 h-8 bg-blue-600 rounded-lg flex items-center justify-center text-white">
      <Trophy size={18} />
      </div>
      <span className="font-black text-sm uppercase tracking-tighter">Code Future</span>
      </div>

      <nav className="flex-1 p-4 space-y-1">
      <button
      onClick={() => navigateTo('/')}
      className="w-full flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-bold transition-all text-(--t2) hover:bg-(--bg) hover:text-blue-600 mb-4 border border-(--brd) border-dashed"
      >
      <Home size={18} /> <span>На головну</span>
      </button>

      <NavItem icon={<LayoutDashboard size={18} />} label="Dashboard" onClick={() => navigateTo('/main_page')} />
      <NavItem icon={<UserCircle size={18} />} label="Мій Профіль" active onClick={() => {}} />
      <NavItem icon={<Settings size={18} />} label="Налаштування" onClick={() => {}} />
      </nav>

      <div className="p-4 mt-auto border-t border-(--brd)">
      <button className="flex items-center gap-3 px-4 py-2.5 w-full text-sm font-bold rounded-xl text-(--t2) hover:text-red-500 transition-colors">
      <LogOut size={18} /> Вихід
      </button>
      </div>
      </aside>

      {/* --- MAIN CONTENT --- */}
      <main className="flex-1 flex flex-col min-w-0">

      {/* MOBILE TOP BAR (Меню зліва, Аватарка справа) */}
      <header className="lg:hidden p-4 flex items-center justify-between bg-(--card) border-b border-(--brd) sticky top-0 z-30">
      <button
      onClick={() => setIsSidebarOpen(true)}
      className="p-2 rounded-xl bg-(--bg) border border-(--brd) text-(--t1) active:scale-95 transition-transform"
      >
      <Menu size={24} />
      </button>

      <span className="font-black text-xs uppercase tracking-widest opacity-50">Профіль</span>

      <button onClick={() => navigateTo('/profile')} className="active:scale-95 transition-transform">
      <div className="w-10 h-10 rounded-full flex items-center justify-center text-white font-bold text-xs bg-blue-600 border-2 border-(--brd)">
      AP
      </div>
      </button>
      </header>

      <div className="p-6 md:p-8 lg:p-12 overflow-y-auto">
      {/* Breadcrumbs */}
      <nav className="flex items-center gap-2 text-[10px] font-black mb-4 uppercase tracking-widest text-(--t2)">
      <button onClick={() => router.push('/')} className="hover:text-blue-600">Головна</button>
      <ChevronRight size={10} />
      <span className="text-(--t1)">Профіль користувача</span>
      </nav>

      <h1 className="text-2xl md:text-3xl font-black text-(--t1) uppercase tracking-tight mb-8">
      Профіль — <span className="text-blue-600">[Учасник]</span>
      </h1>

      <div className="max-w-6xl space-y-6">
      {/* 1. Базова інформація */}
      <section className="bg-(--card) rounded-[2.5rem] shadow-sm border border-(--brd) p-6 md:p-8 flex flex-col md:flex-row items-center gap-8 relative overflow-hidden">
      <div className="absolute right-0 top-0 opacity-5 pointer-events-none text-(--t1) hidden md:block">
      <Shield size={240} />
      </div>

      <div className="relative">
      <div className="w-24 h-24 md:w-32 md:h-32 rounded-full bg-blue-600/10 flex items-center justify-center border-4 border-(--brd) shadow-md">
      <User size={48} className="text-blue-600 md:hidden" />
      <User size={64} className="text-blue-600 hidden md:block" />
      </div>
      <span className="absolute bottom-1 right-1 md:bottom-2 md:right-2 w-5 h-5 md:w-6 md:h-6 bg-green-500 border-4 border-(--card) rounded-full shadow-sm"></span>
      </div>

      <div className="flex-1 space-y-4 z-10 w-full">
      <div className="flex flex-col sm:flex-row justify-between items-center sm:items-start gap-4">
      <div className="text-center sm:text-left">
      <h2 className="text-xl font-black flex flex-wrap justify-center sm:justify-start items-center gap-2 uppercase tracking-tight">
      1. Базова інформація
      <span className="text-green-600 text-[9px] font-black uppercase bg-green-500/10 px-2.5 py-1 rounded-lg border border-green-500/20">
      Активний
      </span>
      </h2>
      <div className="mt-6 space-y-3 text-sm inline-block sm:block text-left">
      <p className="flex items-center gap-3 font-medium">
      <User size={18} className="text-blue-600" />
      <span className="text-(--t2)">Ім'я:</span> <span className="font-bold">Антон Петров</span>
      </p>
      <p className="flex items-center gap-3 font-medium">
      <Mail size={18} className="text-blue-600" />
      <span className="text-(--t2)">Email:</span> <span className="font-bold break-all">a.petrov@tournament.com</span>
      </p>
      <p className="flex items-center gap-3 font-bold text-blue-600">
      <Shield size={18} />
      <span>Роль:</span> <span className="uppercase tracking-wider">Team Lead</span>
      </p>
      </div>
      </div>
      <button className="w-full sm:w-auto bg-blue-600 text-white px-6 py-4 rounded-2xl font-black text-xs uppercase tracking-widest hover:bg-blue-700 transition-all flex items-center justify-center gap-2 shadow-lg shadow-blue-600/20 active:scale-95">
      <Edit2 size={14} /> Редагувати
      </button>
      </div>
      <div className="pt-4 border-t border-(--brd) text-[9px] font-bold uppercase tracking-widest text-(--t2) text-center sm:text-left">
      Реєстрація: 05.02.2023 | Асоціація: (Всі)
      </div>
      </div>
      </section>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
      {/* 2a. Склад команди */}
      <section className="bg-(--card) rounded-[2.5rem] shadow-sm border border-(--brd) p-6 md:p-8">
      <h2 className="text-lg font-black mb-6 flex items-center gap-2 uppercase tracking-tight text-(--t1)">
      <Users className="text-blue-600" /> 2a. Команда
      </h2>
      <div className="space-y-4">
      {[
        { name: "Антон Петров", role: "Team Lead" },
        { name: "Марія Сидоренко", role: "Frontend" },
        { name: "Олег Іванов", role: "UI/UX" },
      ].map((member, i) => (
        <div key={i} className="flex items-center justify-between p-3 rounded-2xl bg-(--bg)/30 border border-(--brd) hover:bg-(--bg)/50 transition-colors">
        <div className="flex items-center gap-3 overflow-hidden">
        <div className="w-8 h-8 rounded-full bg-blue-600/10 flex items-center justify-center font-bold text-blue-600 text-xs flex-shrink-0">
        {member.name.charAt(0)}
        </div>
        <div className="overflow-hidden">
        <p className="font-bold text-sm truncate">{member.name}</p>
        <p className="text-[10px] text-(--t2) font-bold uppercase tracking-tighter">{member.role}</p>
        </div>
        </div>
        <button className="text-blue-600 font-black text-[9px] uppercase hover:underline ml-2">Профіль</button>
        </div>
      ))}
      </div>
      <button className="w-full mt-6 py-4 border-2 border-dashed border-(--brd) rounded-2xl text-(--t2) font-bold text-[10px] uppercase tracking-widest hover:bg-blue-600/5 hover:border-blue-600/30 hover:text-blue-600 transition-all">
      + Додати учасника
      </button>
      </section>

      {/* 2b. Історія сабмітів */}
      <section className="bg-(--card) rounded-[2.5rem] shadow-sm border border-(--brd) p-6 md:p-8">
      <h2 className="text-lg font-black mb-6 flex items-center gap-2 uppercase tracking-tight text-(--t1)">
      <History className="text-blue-600" /> 2b. Сабміти
      </h2>
      <div className="space-y-3">
      {[
        { task: "Проєкт A - API", status: "success", time: "21.03.2026", color: "text-green-600", Icon: CheckCircle },
        { task: "Frontend Base", status: "pending", time: "20.03.2026", color: "text-blue-600", Icon: Clock },
        { task: "Auth System", status: "failed", time: "18.03.2026", color: "text-red-600", Icon: XCircle },
      ].map((sub, i) => (
        <div key={i} className="flex items-center justify-between p-4 rounded-2xl bg-(--bg)/50 border border-(--brd) hover:border-blue-600/20 transition-all">
        <div className="flex items-center gap-4">
        <sub.Icon className={sub.color} size={20} />
        <div>
        <p className="font-bold text-sm leading-none mb-1">{sub.task}</p>
        <p className="text-[9px] font-bold text-(--t2) uppercase tracking-wider">{sub.time}</p>
        </div>
        </div>
        <span className={`text-[8px] font-black uppercase px-2 py-1 rounded-md bg-(--card) border border-(--brd) ${sub.color}`}>
        {sub.status}
        </span>
        </div>
      ))}
      </div>

      <div className="mt-8 p-6 bg-blue-600/5 rounded-3xl border border-blue-600/10 flex items-center justify-between">
      <div>
      <p className="text-[9px] text-blue-600 uppercase font-black tracking-widest mb-1">Успішність</p>
      <p className="text-2xl font-black text-blue-600 leading-none">85%</p>
      </div>
      <div className="text-right">
      <p className="text-[9px] text-(--t2) uppercase font-black tracking-widest mb-1">Сабмітів</p>
      <p className="text-xl font-black text-(--t1) leading-none">23</p>
      </div>
      </div>
      </section>
      </div>
      </div>

      <footer className="mt-12 text-center text-[10px] font-black uppercase tracking-[0.2em] text-(--t2) opacity-50">
      * Профіль оновлено: {new Date().toLocaleTimeString()}
      </footer>
      </div>
      </main>
      </div>
  );
}

function NavItem({ icon, label, active = false, onClick }: { icon: any, label: string, active?: boolean, onClick: () => void }) {
  return (
    <button
    onClick={onClick}
    className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-bold transition-all ${active ? 'bg-blue-600 text-white shadow-lg shadow-blue-600/20 scale-[1.02]' : 'text-(--t2) hover:bg-(--bg) hover:text-blue-600'}`}
    >
    {icon} <span>{label}</span>
    </button>
  );
}
