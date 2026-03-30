"use client";

import React, { useState } from "react";
import { useRouter } from "next/navigation";
import { useTheme } from "@/hooks/useTheme";
import {
  LayoutDashboard, Trophy, Users, User,
  Settings, LogOut, AlertCircle, Plus, Home,
} from "lucide-react";

export default function TeamRegistration() {
  const { dark } = useTheme();
  const router = useRouter();

  const [participants, setParticipants] = useState([
    { id: 1, name: "", email: "" },
    { id: 2, name: "", email: "" },
  ]);

  const addParticipant = () => {
    if (participants.length >= 10) return;
    setParticipants((p) => [...p, { id: Date.now(), name: "", email: "" }]);
  };

  const removeParticipant = (id: number) => {
    if (participants.length <= 2) return;
    setParticipants((p) => p.filter((x) => x.id !== id));
  };

  const updateParticipant = (id: number, field: "name" | "email", value: string) => {
    setParticipants((p) => p.map((x) => (x.id === id ? { ...x, [field]: value } : x)));
  };

  const inputClass = "w-full px-4 py-3 rounded-xl text-sm font-medium outline-none transition-all bg-(--bg) border border-(--brd) text-(--t1) focus:ring-2 focus:ring-blue-500/30 focus:border-blue-600 focus:bg-(--card)";

  return (
    <div className="flex min-h-screen bg-(--bg) font-sans text-(--t1) transition-colors duration-300">

    {/* SIDEBAR */}
    <aside className="hidden lg:flex w-64 bg-(--card) border-r border-(--brd) flex-col transition-colors duration-300">
    <div className="p-6 border-b border-(--brd)">
    <div className="w-10 h-10 bg-blue-600 rounded-xl flex items-center justify-center shadow-lg shadow-blue-600/20">
    <Trophy className="text-white w-5 h-5"/>
    </div>
    </div>
    <nav className="flex-1 px-4 pt-4 space-y-1">
    <button onClick={() => router.push("/")} className="w-full flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-bold transition-all text-(--t2) hover:bg-(--bg) hover:text-blue-600 mb-4 border border-(--brd) border-dashed">
    <Home size={18}/><span>На головну</span>
    </button>
    <SidebarItem icon={<LayoutDashboard size={18}/>} label="Dashboard"    onClick={() => router.push("/main_page")}/>
    <SidebarItem icon={<Trophy size={18}/>}          label="Турніри"      active/>
    <SidebarItem icon={<Users size={18}/>}           label="Команди"/>
    <SidebarItem icon={<User size={18}/>}            label="Гравці"/>
    <SidebarItem icon={<Settings size={18}/>}        label="Налаштування"/>
    </nav>
    <div className="p-4 border-t border-(--brd)">
    <button className="flex items-center gap-3 px-4 py-2.5 w-full text-sm font-bold rounded-xl text-(--t2) hover:text-red-500 transition-colors">
    <LogOut size={18}/> Logout
    </button>
    </div>
    </aside>

    {/* MAIN */}
    <main className="flex-1 p-4 sm:p-8 overflow-y-auto">
    <h1 className="text-2xl sm:text-3xl font-black mb-6 sm:mb-8 tracking-tight uppercase text-(--t1)">
    Реєстрація команди
    </h1>

    <div className="max-w-4xl bg-(--card) rounded-2xl sm:rounded-[2.5rem] shadow-xl border border-(--brd) overflow-hidden">

    {/* Info banner */}
    <div className="bg-blue-600/10 p-4 sm:p-5 border-b border-(--brd)">
    <p className="text-blue-600 font-bold text-sm uppercase tracking-wide flex items-center gap-2 flex-wrap">
    <AlertCircle size={16} className="flex-shrink-0"/>
    Реєстрація на турнір <span className="underline">[Назва Турніру]</span> до: DD.MM.YYYY
    </p>
    </div>

    <div className="p-6 sm:p-10">
    <p className="text-xs font-bold text-(--t2) mb-8 sm:mb-10 uppercase tracking-widest italic opacity-70">
    * Після реєстрації склад команди може редагувати лише Адміністратор.
    </p>

    <form className="space-y-10 sm:space-y-12" onSubmit={(e) => e.preventDefault()}>

    {/* Section 1 */}
    <section className="space-y-4 sm:space-y-6">
    <h3 className="text-base sm:text-lg font-black uppercase tracking-tight text-(--t1) flex items-center gap-3">
    <span className="w-7 h-7 sm:w-8 sm:h-8 rounded-lg bg-(--bg) border border-(--brd) flex items-center justify-center text-xs font-black text-(--t2)">1</span>
    Загальна інформація
    </h3>
    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 sm:gap-6">
    <InputGroup label="Назва команди"   placeholder="Введіть назву"/>
    <InputGroup label="Організація"     placeholder="Напр. СШ №100"/>
    <InputGroup label="Контактний зв'язок" placeholder="@username"/>
    </div>
    </section>

    {/* Section 2 */}
    <section className="space-y-4 sm:space-y-6">
    <h3 className="text-base sm:text-lg font-black uppercase tracking-tight text-(--t1) flex items-center gap-3">
    <span className="w-7 h-7 sm:w-8 sm:h-8 rounded-lg bg-(--bg) border border-(--brd) flex items-center justify-center text-xs font-black text-(--t2)">2</span>
    Капітан
    </h3>
    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 sm:gap-6">
    <InputGroup label="ПІБ Капітана"    placeholder="Іванов Іван"/>
    <InputGroup label="Email капітана"  placeholder="captain@example.com" success/>
    </div>
    </section>

    {/* Section 3 */}
    <section className="space-y-4 sm:space-y-6">
    <div className="flex items-center justify-between flex-wrap gap-3">
    <h3 className="text-base sm:text-lg font-black uppercase tracking-tight text-(--t1) flex items-center gap-3">
    <span className="w-7 h-7 sm:w-8 sm:h-8 rounded-lg bg-(--bg) border border-(--brd) flex items-center justify-center text-xs font-black text-(--t2)">3</span>
    Учасники
    </h3>
    <span className="text-[10px] font-bold text-(--t2) uppercase tracking-widest bg-(--bg) px-3 py-1 rounded-full border border-(--brd)">
    {participants.length} / 10
    </span>
    </div>

    <div className="space-y-3 sm:space-y-4">
    {participants.map((p, idx) => (
      <div key={p.id} className="grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-4 p-4 sm:p-6 rounded-2xl sm:rounded-3xl bg-(--bg)/50 border border-(--brd) relative group hover:border-blue-600/30 transition-all">
      <div className="flex flex-col gap-1.5">
      <label className="text-[10px] font-black text-(--t2) uppercase tracking-[0.15em] ml-1">Учасник {idx + 1}</label>
      <input type="text" placeholder="ПІБ" value={p.name}
      onChange={(e) => updateParticipant(p.id, "name", e.target.value)}
      className={inputClass}/>
      </div>
      <div className="flex flex-col gap-1.5">
      <label className="text-[10px] font-black text-(--t2) uppercase tracking-[0.15em] ml-1">Email</label>
      <div className="relative">
      <input type="email" placeholder="member@example.com" value={p.email}
      onChange={(e) => updateParticipant(p.id, "email", e.target.value)}
      className={`${inputClass} ${p.email ? "border-green-500/50 pr-10" : ""}`}/>
      {p.email && (
        <div className="absolute right-3 top-1/2 -translate-y-1/2 text-green-500">
        <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" viewBox="0 0 20 20" fill="currentColor">
        <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd"/>
        </svg>
        </div>
      )}
      </div>
      </div>
      {participants.length > 2 && (
        <button type="button" onClick={() => removeParticipant(p.id)}
        className="absolute top-3 right-3 w-6 h-6 rounded-full bg-(--bg) border border-(--brd) text-(--t2) hover:text-red-500 hover:border-red-500/30 transition-all text-xs font-black opacity-0 group-hover:opacity-100 flex items-center justify-center">
        ×
        </button>
      )}
      </div>
    ))}
    </div>

    {participants.length < 10 && (
      <button type="button" onClick={addParticipant}
      className="w-full py-4 border-2 border-dashed border-(--brd) rounded-2xl text-(--t2) font-black text-[10px] uppercase tracking-[0.2em] hover:bg-blue-600/5 hover:border-blue-600/30 hover:text-blue-600 transition-all flex items-center justify-center gap-2">
      <Plus size={14}/> Додати учасника
      </button>
    )}
    </section>

    {/* Validation error */}
    {participants.length < 2 && (
      <div className="bg-red-500/10 border border-red-500/20 rounded-2xl p-4 flex items-center gap-3 text-red-500">
      <AlertCircle size={18} className="flex-shrink-0"/>
      <span className="text-xs font-black uppercase tracking-wider">Мінімум 2 учасники для реєстрації</span>
      </div>
    )}

    {/* Buttons */}
    <div className="flex flex-col sm:flex-row gap-3 sm:gap-4 pt-4">
    <button type="submit"
    className="bg-blue-600 text-white px-8 sm:px-10 py-4 rounded-2xl font-black text-xs uppercase tracking-widest hover:bg-blue-700 transition-all active:scale-95 shadow-lg shadow-blue-600/20">
    Створити команду
    </button>
    <button type="button" onClick={() => router.back()}
    className="bg-(--bg) border border-(--brd) text-(--t2) px-8 sm:px-10 py-4 rounded-2xl font-black text-xs uppercase tracking-widest hover:bg-(--card) transition-all">
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

function SidebarItem({ icon, label, active = false, onClick }: { icon?: React.ReactNode; label: string; active?: boolean; onClick?: () => void }) {
  return (
    <button onClick={onClick}
    className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-bold transition-all ${active ? "bg-blue-600 text-white shadow-lg shadow-blue-600/20 scale-[1.02]" : "text-(--t2) hover:bg-(--bg) hover:text-blue-600"}`}>
    {icon}<span>{label}</span>
    </button>
  );
}

function InputGroup({ label, placeholder, success = false }: { label: string; placeholder: string; success?: boolean }) {
  return (
    <div className="flex flex-col gap-1.5">
    <label className="text-[10px] font-black text-(--t2) uppercase tracking-[0.15em] ml-1">{label}</label>
    <div className="relative">
    <input type="text" placeholder={placeholder}
    className={`w-full px-4 sm:px-5 py-3.5 rounded-xl text-sm font-medium outline-none transition-all bg-(--bg) border focus:ring-2 focus:ring-blue-500/20 focus:bg-(--card) text-(--t1) ${success ? "border-green-500/50 pr-10 focus:ring-green-500/20" : "border-(--brd) focus:border-blue-600"}`}/>
    {success && (
      <div className="absolute right-3 top-1/2 -translate-y-1/2 text-green-500">
      <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" viewBox="0 0 20 20" fill="currentColor">
      <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd"/>
      </svg>
      </div>
    )}
    </div>
    </div>
  );
}
