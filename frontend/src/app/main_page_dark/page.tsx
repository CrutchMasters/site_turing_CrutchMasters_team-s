"use client";

import React from 'react';
import { 
  LayoutDashboard, Trophy, Users, User, Settings, 
  LogOut, ExternalLink, Shield 
} from 'lucide-react';

// Вспомогательные компоненты для чистоты кода
const NavItem = ({ icon, label, active = false }: { icon: React.ReactNode, label: string, active?: boolean }) => (
  <div className={`flex items-center gap-3 px-4 py-3 rounded-xl cursor-pointer transition-colors ${active ? 'bg-blue-600 text-white' : 'hover:bg-slate-700/50'}`}>
    {icon}
    <span className="font-medium">{label}</span>
  </div>
);

const FilterButton = ({ label, active = false }: { label: string, active?: boolean }) => (
  <button className={`px-4 py-1.5 rounded-full text-xs font-medium transition-all ${active ? 'bg-blue-600 text-white' : 'bg-slate-700 text-slate-300 hover:bg-slate-600'}`}>
    {label}
  </button>
);

const TournamentRow = ({ name, status, date, participation, statusColor, actionLabel }: any) => (
  <tr className="border-b border-slate-700/30">
    <td className="py-4 font-medium">{name}</td>
    <td className={`py-4 ${statusColor}`}>{status}</td>
    <td className="py-4 text-slate-400">{date}</td>
    <td className="py-4">{participation}</td>
    <td className="py-4 text-right">
      {actionLabel ? (
        <button className="text-blue-400 text-xs font-bold uppercase hover:underline">{actionLabel}</button>
      ) : (
        <button className="text-slate-500 hover:text-white transition-colors"><ExternalLink size={16} /></button>
      )}
    </td>
  </tr>
);

export default function DashboardPage() {
  return (
    <div className="flex min-h-screen bg-slate-50 text-slate-800 font-sans">
      {/* Sidebar */}
      <aside className="w-64 bg-[#1e2235] text-slate-400 p-4 flex flex-col fixed h-full">
        <div className="flex items-center gap-3 mb-8 px-2">
          <div className="w-10 h-10 bg-slate-300 rounded-full flex items-center justify-center">
            <User size={24} className="text-slate-600" />
          </div>
          <div className="text-sm">
            <p className="text-white font-semibold leading-none">Anton Petrov</p>
          </div>
        </div>

        <nav className="flex-1 space-y-1">
          <NavItem icon={<LayoutDashboard size={20} />} label="Dashboard" active />
          <NavItem icon={<Trophy size={20} />} label="Турніри" />
          <NavItem icon={<Users size={20} />} label="Команди" />
          <NavItem icon={<User size={20} />} label="Гравці" />
          <NavItem icon={<Settings size={20} />} label="Налаштування" />
        </nav>

        <div className="pt-4 border-t border-slate-700 space-y-1">
          <NavItem icon={<LogOut size={20} />} label="Logout" />
        </div>
      </aside>

      {/* Main Content */}
      <main className="flex-1 ml-64 p-8 relative min-h-screen overflow-hidden">
        <Shield className="absolute -right-20 top-1/2 -translate-y-1/2 text-slate-200 w-96 h-96 -z-10 opacity-30" />
        <Shield className="absolute -left-20 top-1/4 text-slate-200 w-64 h-64 -z-10 opacity-30" />

        <header className="flex justify-between items-center mb-6">
          <div>
            <nav className="text-sm text-slate-500 mb-1">Головна &gt; Дашборд</nav>
            <h1 className="text-2xl font-bold text-slate-900">8. Головна сторінка - Огляд</h1>
          </div>
          <div className="text-right text-sm text-slate-500">
            [Результатно Admin] - 12.03.2026 18:00
          </div>
        </header>

        <div className="max-w-4xl space-y-8">
          <section className="bg-[#1e2235] rounded-xl p-6 text-white shadow-xl">
            <h2 className="text-xl font-semibold mb-4">1. Список турнірів</h2>
            <div className="flex gap-2 mb-6 flex-wrap">
              <FilterButton label="Всі" active />
              <FilterButton label="Registration Open" />
              <FilterButton label="Running" />
              <FilterButton label="Finished" />
            </div>

            <table className="w-full text-left text-sm">
              <thead>
                <tr className="border-b border-slate-700 text-slate-400">
                  <th className="pb-3 font-medium">Назва турніру</th>
                  <th className="pb-3 font-medium">Статус</th>
                  <th className="pb-3 font-medium">Дата старту</th>
                  <th className="pb-3 font-medium">Ваша участь</th>
                  <th className="pb-3 font-medium text-right">Дії</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-700/50">
                <TournamentRow name="Весняний хакатон 2026" status="Running" date="12.01.2026" participation="Дати" statusColor="text-orange-400" />
                <TournamentRow name="Summer Code Jam" status="Registration" date="02.01.2026" participation="—" statusColor="text-yellow-400" actionLabel="Зареєструватись" />
              </tbody>
            </table>
          </section>

          <section>
            <h2 className="text-xl font-semibold mb-4 text-slate-900">2. Команда: Team Alpha</h2>
            <div className="bg-[#1e2235] rounded-xl p-6 text-white shadow-xl">
               <div className="flex justify-between items-center border-b border-slate-700 pb-4 mb-4">
                  <div>
                    <p className="text-xs text-slate-400 uppercase">Поточний турнір</p>
                    <p className="text-blue-400 flex items-center gap-1">Весняний хакатон 2026 <ExternalLink size={14}/></p>
                  </div>
                  <span className="text-orange-400 text-sm font-bold">Running</span>
               </div>
               <div className="flex justify-between items-center">
                  <p className="text-sm">Ваше завдання: Створення API</p>
                  <button className="bg-blue-600 hover:bg-blue-700 px-6 py-2 rounded-lg font-medium">Здати</button>
               </div>
            </div>
          </section>
        </div>
      </main>
    </div>
  );
}