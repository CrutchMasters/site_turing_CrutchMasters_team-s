'use client';

import React from 'react';
import Link from 'next/link';
import {
  User,
  Mail,
  ShieldCheck,
  Users,
  History,
  CheckCircle,
  Clock,
  XCircle,
  ArrowLeft
} from 'lucide-react';

export default function UserProfile() {
  return (
    <div className="min-h-screen bg-[#F1F3F5] text-slate-800 relative overflow-x-hidden">

    {/* --- СИСТЕМА ФОНА (Как на главной) --- */}
    <div className="fixed inset-0 flex items-center justify-center z-0 pointer-events-none opacity-[0.04]">
    <img
    src="/logo_backround1.svg"
    alt="Background Watermark"
    className="w-[800px] h-[800px] object-contain"
    />
    </div>

    {/* Основной контент */}
    <div className="relative z-10 p-4 md:p-8">

    <header className="mb-8 max-w-6xl mx-auto">
    <div className="flex items-center gap-4 mb-4">
    <Link
    href="/main_page"
    className="p-2 bg-white border border-slate-200 rounded-xl text-slate-600 hover:text-blue-600 hover:border-blue-200 transition-all shadow-sm"
    >
    <ArrowLeft size={20} />
    </Link>
    <nav className="text-sm text-slate-500 font-medium">
    <Link href="/main_page" className="hover:text-blue-600">Головна</Link> / Профіль користувача
    </nav>
    </div>
    <h1 className="text-2xl font-black text-slate-900 uppercase tracking-tight">
    Профіль користувача — <span className="text-blue-600">Anton Petrov</span>
    </h1>
    </header>

    <div className="max-w-6xl mx-auto space-y-6">

    {/* 1. Базова інформація */}
    <section className="bg-white/95 backdrop-blur-md rounded-2xl shadow-sm border border-slate-200 p-6 flex flex-col md:flex-row items-center gap-8 relative overflow-hidden">
    <div className="relative">
    <div className="w-32 h-32 rounded-full bg-blue-50 flex items-center justify-center border-4 border-white shadow-md">
    <User size={64} className="text-blue-600" />
    </div>
    <span className="absolute bottom-2 right-2 w-6 h-6 bg-green-500 border-4 border-white rounded-full"></span>
    </div>

    <div className="flex-1 space-y-3 relative z-10">
    <div className="flex flex-col lg:flex-row justify-between items-start gap-4">
    <div>
    <h2 className="text-xl font-bold flex items-center gap-2 text-slate-900">
    1. Базова інформація
    <span className="text-green-600 text-[10px] font-black uppercase bg-green-50 px-2 py-1 rounded border border-green-100">
    Активний
    </span>
    </h2>
    <div className="mt-4 space-y-2">
    <p className="flex items-center gap-2 text-slate-600">
    <User size={16} className="text-blue-600" /> <strong>Ім'я:</strong> Антон Петров
    </p>
    <p className="flex items-center gap-2 text-slate-600">
    <Mail size={16} className="text-blue-600" /> <strong>Email:</strong> a.petrov@tournament.com
    </p>
    <p className="flex items-center gap-2 text-blue-700 font-bold bg-blue-50 w-fit px-3 py-1 rounded-lg border border-blue-100">
    <ShieldCheck size={16} /> Роль: Учасник (Team Lead)
    </p>
    </div>
    </div>
    <button className="bg-slate-900 text-white px-6 py-2.5 rounded-xl font-bold text-sm hover:bg-blue-600 transition-all shadow-lg active:scale-95">
    Редагувати дані
    </button>
    </div>
    </div>
    </section>

    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">

    {/* 2a. Команда */}
    <section className="bg-white/95 backdrop-blur-md rounded-2xl shadow-sm border border-slate-200 p-6">
    <h2 className="text-lg font-bold mb-4 flex items-center gap-2 text-slate-800">
    <Users className="text-blue-600" size={20} /> 2a. Склад команди
    </h2>
    <div className="overflow-x-auto">
    <table className="w-full text-left border-collapse">
    <thead>
    <tr className="border-b border-slate-100 text-[10px] font-black text-slate-400 uppercase bg-slate-50/50">
    <th className="px-4 py-3">Учасник</th>
    <th className="px-4 py-3">Роль</th>
    <th className="px-4 py-3 text-right">Статус</th>
    </tr>
    </thead>
    <tbody className="text-sm">
    {[
      { name: "Антон Петров", role: "Team Lead", initials: "AP", status: 'Online' },
      { name: "Марія Сидоренко", role: "Frontend", initials: "MS", status: 'Online' },
      { name: "Олег Іванов", role: "Designer", initials: "OI", status: 'Offline' },
    ].map((member, i) => (
      <tr key={i} className="border-b border-slate-50 last:border-0 hover:bg-slate-50/50 transition-colors">
      <td className="px-4 py-3 flex items-center gap-3 font-bold text-slate-700">
      <div className="w-8 h-8 rounded-full bg-blue-600 flex items-center justify-center text-[10px] text-white font-black shadow-sm">
      {member.initials}
      </div>
      {member.name}
      </td>
      <td className="px-4 py-3 text-slate-500 font-medium">{member.role}</td>
      <td className="px-4 py-3 text-right">
      <span className={`text-[10px] font-black uppercase px-2 py-1 rounded ${member.status === 'Online' ? 'text-green-600 bg-green-50' : 'text-slate-400 bg-slate-100'}`}>
      {member.status}
      </span>
      </td>
      </tr>
    ))}
    </tbody>
    </table>
    </div>
    </section>

    {/* 2b. Історія сабмітів */}
    <section className="bg-white/95 backdrop-blur-md rounded-2xl shadow-sm border border-slate-200 p-6">
    <h2 className="text-lg font-bold mb-4 flex items-center gap-2 text-slate-800">
    <History className="text-blue-600" size={20} /> 2b. Історія сабмітів
    </h2>
    <div className="space-y-3">
    {[
      { task: "API System", status: "success", time: "21.03.2026", color: "text-emerald-600 bg-emerald-50", Icon: CheckCircle },
      { task: "Frontend Base", status: "pending", time: "20.03.2026", color: "text-blue-600 bg-blue-50", Icon: Clock },
    ].map((sub, i) => (
      <div key={i} className="flex items-center justify-between p-4 rounded-xl bg-slate-50 border border-transparent hover:border-slate-100 transition-all">
      <div className="flex items-center gap-3">
      <sub.Icon className={sub.color.split(' ')[0]} size={20} />
      <div>
      <p className="font-bold text-sm text-slate-700">{sub.task}</p>
      <p className="text-[10px] font-bold text-slate-400 uppercase">{sub.time}</p>
      </div>
      </div>
      <span className={`text-[10px] font-black uppercase px-2 py-1 rounded border ${sub.color}`}>
      {sub.status}
      </span>
      </div>
    ))}
    </div>
    </section>

    </div>
    </div>

    <footer className="mt-8 text-center text-[10px] font-bold text-slate-400 uppercase tracking-widest">
    * Powered by Crutch Masters — {new Date().toLocaleDateString()}
    </footer>
    </div>
    </div>
  );
}
