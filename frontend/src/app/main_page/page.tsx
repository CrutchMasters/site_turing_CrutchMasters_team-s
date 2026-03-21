import React from 'react';
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
  FileText
} from 'lucide-react';

export default function HomePage() {
  return (
    <div className="flex min-h-screen bg-[#F8FAFC]">
      {/* Sidebar - залишаємо темним для професійного контрасту */}
      <aside className="w-64 bg-[#1E293B] text-slate-300 flex flex-col shrink-0">
        <div className="p-6 flex items-center gap-3 border-b border-slate-800">
          <div className="w-10 h-10 bg-indigo-600 rounded-full flex items-center justify-center text-white shadow-lg font-bold">
            AP
          </div>
          <div className="overflow-hidden">
            <p className="text-sm font-bold text-white truncate">Anton Petrov</p>
            <p className="text-[10px] text-slate-500 uppercase tracking-wider">Admin Role</p>
          </div>
        </div>

        <nav className="flex-1 p-4 space-y-1">
          <NavItem icon={<LayoutDashboard size={18} />} label="Dashboard" active />
          <NavItem icon={<Trophy size={18} />} label="Турніри" />
          <NavItem icon={<Users size={18} />} label="Команди" />
          <NavItem icon={<UserCircle size={18} />} label="Гравці" />
          <NavItem icon={<Settings size={18} />} label="Налаштування" />
        </nav>

        <div className="p-4 mt-auto border-t border-slate-800">
          <button className="flex items-center gap-3 px-4 py-2 hover:text-red-400 transition-colors w-full text-sm font-medium">
            <LogOut size={18} /> Вихід
          </button>
        </div>
      </aside>

      {/* Main Content Area */}
      <main className="flex-1 p-8 overflow-y-auto">
        <header className="mb-8">
          <div className="flex items-center gap-2 text-xs text-slate-400 mb-2 font-medium">
            <span>Головна</span>
            <ChevronRight size={12} />
            <span className="text-slate-600">Дашборд</span>
          </div>
          <h1 className="text-2xl font-black text-slate-900 tracking-tight">8. Головна сторінка - Огляд</h1>
        </header>

        <div className="max-w-6xl space-y-8">
          
          {/* 1. Список турнірів */}
          <section className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden">
            <div className="p-6 border-b border-slate-100 flex flex-col md:flex-row md:items-center justify-between gap-4">
              <h2 className="font-bold text-lg text-slate-800">1. Список турнірів</h2>
              <div className="flex flex-wrap gap-2">
                <FilterButton label="Всі" active />
                <FilterButton label="Registration Open" />
                <FilterButton label="Running" />
                <FilterButton label="Finished" />
              </div>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse">
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

          {/* 2. Команда: Team Alpha - ТЕПЕР У СВІТЛІЙ ТЕМІ */}
          <section className="bg-white rounded-2xl shadow-sm border border-slate-200 p-6 relative overflow-hidden">
            {/* Декоративний елемент на фоні */}
            <div className="absolute -right-8 -top-8 w-32 h-32 bg-indigo-50 rounded-full blur-3xl opacity-60" />
            
            <h2 className="font-bold text-lg text-slate-800 mb-6 flex items-center gap-2">
              <Users className="text-indigo-600" size={20} /> 2. Команда: Team Alpha
            </h2>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-6 relative z-10">
              {/* Поточний турнір */}
              <div className="p-4 rounded-xl bg-slate-50 border border-slate-100">
                <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1">Поточний турнір</p>
                <div className="flex items-center justify-between">
                  <a href="#" className="font-bold text-slate-900 hover:text-indigo-600 transition-colors flex items-center gap-1.5">
                    Весняний хакатон 2026 <ExternalLink size={14} />
                  </a>
                  <span className="text-[9px] font-black uppercase px-1.5 py-0.5 rounded bg-orange-100 text-orange-600 border border-orange-200">
                    Running
                  </span>
                </div>
              </div>

              {/* Ваше завдання */}
              <div className="p-4 rounded-xl bg-slate-50 border border-slate-100">
                <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1">Ваше завдання</p>
                <p className="font-semibold text-slate-800">Створення API для авторизації</p>
              </div>

              {/* Ваш сабміт */}
              <div className="p-4 rounded-xl bg-indigo-50/50 border border-indigo-100">
                <p className="text-[10px] font-bold text-indigo-400 uppercase tracking-wider mb-1">Останній сабміт</p>
                <div className="flex items-center gap-2 text-indigo-700">
                  <FileText size={16} />
                  <p className="text-sm font-bold italic">v2_final_build.zip</p>
                </div>
              </div>
            </div>

            <div className="mt-6 flex flex-col sm:flex-row items-center justify-between gap-4 pt-6 border-t border-slate-100">
              <p className="text-xs text-slate-500">
                <span className="font-bold text-slate-400 italic">Статус:</span> Файли перевіряються автоматичною системою...
              </p>
              <button className="bg-indigo-600 hover:bg-indigo-700 text-white px-8 py-3 rounded-xl font-bold text-sm shadow-md shadow-indigo-200 transition-all active:scale-95 flex items-center gap-2 w-full sm:w-auto justify-center">
                <Upload size={18} /> Здати нову версію
              </button>
            </div>
          </section>

        </div>
      </main>
    </div>
  );
}

// Допоміжні компоненти
function NavItem({ icon, label, active = false }: { icon: any, label: string, active?: boolean }) {
  return (
    <button className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-medium transition-all ${
      active 
      ? 'bg-indigo-600 text-white shadow-md shadow-indigo-900/20' 
      : 'hover:bg-slate-800 hover:text-white'
    }`}>
      {icon} <span>{label}</span>
    </button>
  );
}

function FilterButton({ label, active = false }: { label: string, active?: boolean }) {
  return (
    <button className={`px-4 py-1.5 rounded-full text-xs font-bold transition-all ${
      active 
      ? 'bg-indigo-600 text-white shadow-sm shadow-indigo-100' 
      : 'bg-slate-100 text-slate-500 hover:bg-slate-200 border border-slate-200/50'
    }`}>
      {label}
    </button>
  );
}

function TournamentRow({ title, status, statusType, date, participation, isSpecialAction }: any) {
  const statusStyles = {
    warning: 'text-orange-600 bg-orange-50 border-orange-100',
    info: 'text-indigo-600 bg-indigo-50 border-indigo-100',
    success: 'text-emerald-600 bg-emerald-50 border-emerald-100'
  };

  return (
    <tr className="hover:bg-slate-50/50 transition-colors group">
      <td className="px-6 py-5 font-bold text-slate-700 underline-offset-4 decoration-indigo-200 group-hover:underline">{title}</td>
      <td className="px-6 py-5">
        <span className={`text-[10px] font-black uppercase px-2 py-1 rounded border ${statusStyles[statusType as keyof typeof statusStyles]}`}>
          {status}
        </span>
      </td>
      <td className="px-6 py-5 text-slate-500 font-medium">{date}</td>
      <td className="px-6 py-5 text-slate-700 font-medium">{participation}</td>
      <td className="px-6 py-5 text-right">
        {isSpecialAction ? (
          <button className="text-indigo-600 font-black text-[10px] uppercase tracking-tighter hover:bg-indigo-50 px-3 py-1.5 rounded-lg border border-indigo-100 transition-all">
            Зареєструватись
          </button>
        ) : (
          <button className="p-2 text-slate-300 group-hover:text-indigo-600 group-hover:bg-indigo-50 rounded-lg transition-all">
            <ExternalLink size={18} />
          </button>
        )}
      </td>
    </tr>
  );
}