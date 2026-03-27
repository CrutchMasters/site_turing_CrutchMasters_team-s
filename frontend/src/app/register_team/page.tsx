"use client";

import React, { useState } from 'react';
import { useTheme } from "@/hooks/useTheme"; // Імпортуємо хук для теми
import {
  LayoutDashboard,
  Trophy,
  Users,
  User,
  Settings,
  LogOut,
  AlertCircle,
  Plus
} from 'lucide-react';

export default function TeamRegistration() {
  const { dark } = useTheme(); // Отримуємо стан теми
  const [participants, setParticipants] = useState([
    { id: 1, name: '', email: 'captain@example.com' },
    { id: 2, name: '', email: 'captain@example.com' },
  ]);

  return (
    /* Замінено bg-[#f0f4f8] на bg-(--bg) та текст на text-(--t1) */
    <div className="flex min-h-screen bg-(--bg) font-sans text-(--t1) transition-colors duration-300">

    {/* --- SIDEBAR --- */}
    <aside className="w-64 bg-(--card) border-r border-(--brd) flex flex-col transition-colors duration-300">
    <div className="p-6">
    <div className="w-10 h-10 bg-blue-600 rounded-xl flex items-center justify-center shadow-lg shadow-blue-600/20">
    <Trophy className="text-white w-6 h-6" />
    </div>
    </div>

    <nav className="flex-1 px-4 space-y-1">
    <SidebarItem icon={<LayoutDashboard size={20}/>} label="Dashboard" />
    <SidebarItem icon={<Trophy size={20}/>} label="Турніри" active />
    <SidebarItem icon={<Users size={20}/>} label="Команди" />
    <SidebarItem icon={<User size={20}/>} label="Гравці" />
    <SidebarItem icon={<Settings size={20}/>} label="Налаштування" />
    </nav>

    <div className="mt-auto p-4 border-t border-(--brd) space-y-1">
    <div className="text-center font-black text-(--t2) py-4 text-[10px] uppercase tracking-widest opacity-50">Team View</div>
    <SidebarItem icon={<Settings size={20}/>} label="Налаштування" />
    <SidebarItem icon={<LogOut size={20}/>} label="Logout" />
    </div>
    </aside>

    {/* --- MAIN CONTENT --- */}
    <main className="flex-1 p-8 overflow-y-auto">
    <h1 className="text-3xl font-black mb-8 tracking-tight uppercase text-(--t1)">
    Реєстрація команди
    </h1>

    <div className="max-w-4xl bg-(--card) rounded-[2.5rem] shadow-xl border border-(--brd) overflow-hidden transition-all">
    {/* Info Banner: Адаптований під темну тему */}
    <div className="bg-blue-600/10 p-5 border-b border-(--brd)">
    <p className="text-blue-600 font-bold text-sm uppercase tracking-wide flex items-center gap-2">
    <AlertCircle size={16} /> Реєстрація на турнір <span className="underline">[Назва Турніру]</span> до: DD.MM.YYYY
    </p>
    </div>

    <div className="p-10">
    <p className="text-xs font-bold text-(--t2) mb-10 uppercase tracking-widest italic opacity-70">
    * Після реєстрації склад команди може редагувати лише Адміністратор.
    </p>

    <form className="space-y-12">
    {/* Section 1 */}
    <section className="space-y-6">
    <h3 className="text-lg font-black uppercase tracking-tight text-(--t1) flex items-center gap-3">
    <span className="w-8 h-8 rounded-lg bg-(--bg) flex items-center justify-center text-xs">1</span>
    Загальна інформація
    </h3>
    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
    <InputGroup label="Назва команди" placeholder="Введіть назву" />
    <InputGroup label="Організація" placeholder="Напр. СШ №100" />
    <InputGroup label="Контактний зв'язок" placeholder="@username" />
    </div>
    </section>

    {/* Section 2 */}
    <section className="space-y-6">
    <h3 className="text-lg font-black uppercase tracking-tight text-(--t1) flex items-center gap-3">
    <span className="w-8 h-8 rounded-lg bg-(--bg) flex items-center justify-center text-xs">2</span>
    Капітан
    </h3>
    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
    <InputGroup label="ПІБ Капітана" placeholder="Іванов Іван" />
    <InputGroup label="Email капітана" placeholder="captain@example.com" success />
    </div>
    </section>

    {/* Section 3 */}
    <section className="space-y-6">
    <div className="flex items-center justify-between">
    <h3 className="text-lg font-black uppercase tracking-tight text-(--t1) flex items-center gap-3">
    <span className="w-8 h-8 rounded-lg bg-(--bg) flex items-center justify-center text-xs">3</span>
    Учасники
    </h3>
    <span className="text-[10px] font-bold text-(--t2) uppercase tracking-widest bg-(--bg) px-3 py-1 rounded-full border border-(--brd)">
    Мінімум 2 / Максимум 10
    </span>
    </div>

    <div className="space-y-4">
    {participants.map((p, idx) => (
      <div key={p.id} className="grid grid-cols-1 md:grid-cols-2 gap-4 p-6 rounded-3xl bg-(--bg)/50 border border-(--brd) relative group transition-all hover:border-blue-600/30">
      <InputGroup label={`Учасник ${idx + 1}`} placeholder="ПІБ" />
      <InputGroup label={`Email`} placeholder="member@example.com" success />
      </div>
    ))}
    </div>

    <button type="button" className="w-full py-4 border-2 border-dashed border-(--brd) rounded-2xl text-(--t2) font-black text-[10px] uppercase tracking-[0.2em] hover:bg-blue-600/5 hover:border-blue-600/30 hover:text-blue-600 transition-all flex items-center justify-center gap-2">
    <Plus size={14} /> Додати учасника
    </button>
    </section>

    {/* Status/Error Message */}
    <div className="bg-red-500/10 border border-red-500/20 rounded-2xl p-4 flex items-center gap-3 text-red-500">
    <AlertCircle size={20} />
    <span className="text-xs font-black uppercase tracking-wider">Мінімум 2 учасники для реєстрації</span>
    </div>

    {/* Buttons */}
    <div className="flex flex-col sm:flex-row gap-4 pt-6">
    <button type="submit" className="bg-blue-600 text-white px-10 py-4 rounded-2xl font-black text-xs uppercase tracking-widest hover:bg-blue-700 transition-all active:scale-95 shadow-lg shadow-blue-600/20">
    Створити команду
    </button>
    <button type="button" className="bg-(--bg) border border-(--brd) text-(--t2) px-10 py-4 rounded-2xl font-black text-xs uppercase tracking-widest hover:bg-(--card) transition-all">
    Скасувати
    </button>
    </div>
    </form>
    </div>
    </div>
    </main>
    </div>
  );
}

// Допоміжні компоненти
function SidebarItem({ icon, label, active = false }: { icon: React.ReactNode, label: string, active?: boolean }) {
  return (
    <div className={`flex items-center gap-3 px-4 py-3 rounded-xl cursor-pointer font-bold text-sm transition-all ${active ? 'bg-blue-600 text-white shadow-lg shadow-blue-600/20 scale-[1.02]' : 'text-(--t2) hover:bg-(--bg) hover:text-blue-600'}`}>
    {icon}
    <span>{label}</span>
    </div>
  );
}

function InputGroup({ label, placeholder, success = false }: { label: string, placeholder: string, success?: boolean }) {
  return (
    <div className="flex flex-col gap-2">
    <label className="text-[10px] font-black text-(--t2) uppercase tracking-[0.15em] ml-1">{label}</label>
    <div className="relative">
    <input
    type="text"
    placeholder={placeholder}
    className={`w-full px-5 py-3.5 rounded-xl text-sm font-medium outline-none transition-all bg-(--bg) border focus:ring-2 focus:ring-blue-500/20 focus:bg-(--card) ${success ? 'border-green-500/50 pr-12 text-green-600' : 'border-(--brd) text-(--t1) focus:border-blue-600'}`}
    />
    {success && (
      <div className="absolute right-4 top-1/2 -translate-y-1/2 text-green-500">
      <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
      <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
      </svg>
      </div>
    )}
    </div>
    </div>
  );
}"use client";

    import React, { useState } from 'react';
    import { useTheme } from "@/hooks/useTheme"; // Імпортуємо хук для теми
    import {
      LayoutDashboard,
      Trophy,
      Users,
      User,
      Settings,
      LogOut,
      AlertCircle,
      Plus
    } from 'lucide-react';

    export default function TeamRegistration() {
      const { dark } = useTheme(); // Отримуємо стан теми
      const [participants, setParticipants] = useState([
        { id: 1, name: '', email: 'captain@example.com' },
        { id: 2, name: '', email: 'captain@example.com' },
      ]);

      return (
        /* Замінено bg-[#f0f4f8] на bg-(--bg) та текст на text-(--t1) */
        <div className="flex min-h-screen bg-(--bg) font-sans text-(--t1) transition-colors duration-300">

        {/* --- SIDEBAR --- */}
        <aside className="w-64 bg-(--card) border-r border-(--brd) flex flex-col transition-colors duration-300">
        <div className="p-6">
        <div className="w-10 h-10 bg-blue-600 rounded-xl flex items-center justify-center shadow-lg shadow-blue-600/20">
        <Trophy className="text-white w-6 h-6" />
        </div>
        </div>

        <nav className="flex-1 px-4 space-y-1">
        <SidebarItem icon={<LayoutDashboard size={20}/>} label="Dashboard" />
        <SidebarItem icon={<Trophy size={20}/>} label="Турніри" active />
        <SidebarItem icon={<Users size={20}/>} label="Команди" />
        <SidebarItem icon={<User size={20}/>} label="Гравці" />
        <SidebarItem icon={<Settings size={20}/>} label="Налаштування" />
        </nav>

        <div className="mt-auto p-4 border-t border-(--brd) space-y-1">
        <div className="text-center font-black text-(--t2) py-4 text-[10px] uppercase tracking-widest opacity-50">Team View</div>
        <SidebarItem icon={<Settings size={20}/>} label="Налаштування" />
        <SidebarItem icon={<LogOut size={20}/>} label="Logout" />
        </div>
        </aside>

        {/* --- MAIN CONTENT --- */}
        <main className="flex-1 p-8 overflow-y-auto">
        <h1 className="text-3xl font-black mb-8 tracking-tight uppercase text-(--t1)">
        Реєстрація команди
        </h1>

        <div className="max-w-4xl bg-(--card) rounded-[2.5rem] shadow-xl border border-(--brd) overflow-hidden transition-all">
        {/* Info Banner: Адаптований під темну тему */}
        <div className="bg-blue-600/10 p-5 border-b border-(--brd)">
        <p className="text-blue-600 font-bold text-sm uppercase tracking-wide flex items-center gap-2">
        <AlertCircle size={16} /> Реєстрація на турнір <span className="underline">[Назва Турніру]</span> до: DD.MM.YYYY
        </p>
        </div>

        <div className="p-10">
        <p className="text-xs font-bold text-(--t2) mb-10 uppercase tracking-widest italic opacity-70">
        * Після реєстрації склад команди може редагувати лише Адміністратор.
        </p>

        <form className="space-y-12">
        {/* Section 1 */}
        <section className="space-y-6">
        <h3 className="text-lg font-black uppercase tracking-tight text-(--t1) flex items-center gap-3">
        <span className="w-8 h-8 rounded-lg bg-(--bg) flex items-center justify-center text-xs">1</span>
        Загальна інформація
        </h3>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <InputGroup label="Назва команди" placeholder="Введіть назву" />
        <InputGroup label="Організація" placeholder="Напр. СШ №100" />
        <InputGroup label="Контактний зв'язок" placeholder="@username" />
        </div>
        </section>

        {/* Section 2 */}
        <section className="space-y-6">
        <h3 className="text-lg font-black uppercase tracking-tight text-(--t1) flex items-center gap-3">
        <span className="w-8 h-8 rounded-lg bg-(--bg) flex items-center justify-center text-xs">2</span>
        Капітан
        </h3>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <InputGroup label="ПІБ Капітана" placeholder="Іванов Іван" />
        <InputGroup label="Email капітана" placeholder="captain@example.com" success />
        </div>
        </section>

        {/* Section 3 */}
        <section className="space-y-6">
        <div className="flex items-center justify-between">
        <h3 className="text-lg font-black uppercase tracking-tight text-(--t1) flex items-center gap-3">
        <span className="w-8 h-8 rounded-lg bg-(--bg) flex items-center justify-center text-xs">3</span>
        Учасники
        </h3>
        <span className="text-[10px] font-bold text-(--t2) uppercase tracking-widest bg-(--bg) px-3 py-1 rounded-full border border-(--brd)">
        Мінімум 2 / Максимум 10
        </span>
        </div>

        <div className="space-y-4">
        {participants.map((p, idx) => (
          <div key={p.id} className="grid grid-cols-1 md:grid-cols-2 gap-4 p-6 rounded-3xl bg-(--bg)/50 border border-(--brd) relative group transition-all hover:border-blue-600/30">
          <InputGroup label={`Учасник ${idx + 1}`} placeholder="ПІБ" />
          <InputGroup label={`Email`} placeholder="member@example.com" success />
          </div>
        ))}
        </div>

        <button type="button" className="w-full py-4 border-2 border-dashed border-(--brd) rounded-2xl text-(--t2) font-black text-[10px] uppercase tracking-[0.2em] hover:bg-blue-600/5 hover:border-blue-600/30 hover:text-blue-600 transition-all flex items-center justify-center gap-2">
        <Plus size={14} /> Додати учасника
        </button>
        </section>

        {/* Status/Error Message */}
        <div className="bg-red-500/10 border border-red-500/20 rounded-2xl p-4 flex items-center gap-3 text-red-500">
        <AlertCircle size={20} />
        <span className="text-xs font-black uppercase tracking-wider">Мінімум 2 учасники для реєстрації</span>
        </div>

        {/* Buttons */}
        <div className="flex flex-col sm:flex-row gap-4 pt-6">
        <button type="submit" className="bg-blue-600 text-white px-10 py-4 rounded-2xl font-black text-xs uppercase tracking-widest hover:bg-blue-700 transition-all active:scale-95 shadow-lg shadow-blue-600/20">
        Створити команду
        </button>
        <button type="button" className="bg-(--bg) border border-(--brd) text-(--t2) px-10 py-4 rounded-2xl font-black text-xs uppercase tracking-widest hover:bg-(--card) transition-all">
        Скасувати
        </button>
        </div>
        </form>
        </div>
        </div>
        </main>
        </div>
      );
    }

    // Допоміжні компоненти
    function SidebarItem({ icon, label, active = false }: { icon: React.ReactNode, label: string, active?: boolean }) {
      return (
        <div className={`flex items-center gap-3 px-4 py-3 rounded-xl cursor-pointer font-bold text-sm transition-all ${active ? 'bg-blue-600 text-white shadow-lg shadow-blue-600/20 scale-[1.02]' : 'text-(--t2) hover:bg-(--bg) hover:text-blue-600'}`}>
        {icon}
        <span>{label}</span>
        </div>
      );
    }

    function InputGroup({ label, placeholder, success = false }: { label: string, placeholder: string, success?: boolean }) {
      return (
        <div className="flex flex-col gap-2">
        <label className="text-[10px] font-black text-(--t2) uppercase tracking-[0.15em] ml-1">{label}</label>
        <div className="relative">
        <input
        type="text"
        placeholder={placeholder}
        className={`w-full px-5 py-3.5 rounded-xl text-sm font-medium outline-none transition-all bg-(--bg) border focus:ring-2 focus:ring-blue-500/20 focus:bg-(--card) ${success ? 'border-green-500/50 pr-12 text-green-600' : 'border-(--brd) text-(--t1) focus:border-blue-600'}`}
        />
        {success && (
          <div className="absolute right-4 top-1/2 -translate-y-1/2 text-green-500">
          <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
          <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
          </svg>
          </div>
        )}
        </div>
        </div>
      );
    }
