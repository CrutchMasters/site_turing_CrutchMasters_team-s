"use client";

import React, { useState } from 'react';
import {
  LayoutDashboard,
  Trophy,
  Users,
  User,
  Settings,
  LogOut,
  AlertCircle
} from 'lucide-react';

export default function TeamRegistration() {
  const [participants, setParticipants] = useState([
    { id: 1, name: '', email: 'captain@example.com' },
    { id: 2, name: '', email: 'captain@example.com' },
  ]);

  return (
    <div className="flex min-h-screen bg-[#f0f4f8] font-sans text-slate-800">
      {/* Sidebar */}
      <aside className="w-64 bg-white border-r border-slate-200 flex flex-col">
        <div className="p-6">
          <div className="w-8 h-8 bg-blue-600 rounded-lg flex items-center justify-center shadow-sm">
            <Trophy className="text-white w-5 h-5" />
          </div>
        </div>

        <nav className="flex-1 px-4 space-y-1">
          <SidebarItem icon={<LayoutDashboard size={20}/>} label="Dashboard" />
          <SidebarItem icon={<Trophy size={20}/>} label="Турніри" active />
          <SidebarItem icon={<Users size={20}/>} label="Команди" />
          <SidebarItem icon={<User size={20}/>} label="Гравці" />
          <SidebarItem icon={<Settings size={20}/>} label="Налаштування" />
        </nav>

        <div className="mt-auto p-4 space-y-1">
           <div className="text-center font-bold text-slate-400 py-4">Team View</div>
           <SidebarItem icon={<Settings size={20}/>} label="Налаштування" />
           <SidebarItem icon={<LogOut size={20}/>} label="Logout" />
        </div>
      </aside>

      {/* Main Content */}
      <main className="flex-1 p-8 overflow-y-auto">
        <h1 className="text-2xl font-bold mb-6">Реєстрація команд (Team Registration)</h1>

        <div className="max-w-4xl bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
          {/* Info Banner */}
          <div className="bg-blue-50 p-4 border-b border-blue-100">
            <p className="text-blue-800 font-medium">
              Реєстрація на турнір <span className="font-bold">[Назва Турніру]</span> доступна до: DD.MM.YYYY HH:MM
            </p>
          </div>

          <div className="p-8">
            <p className="text-sm text-slate-500 mb-8 italic">
              Після реєстрації склад команди може редагувати лише Адміністратор.
            </p>

            <form className="space-y-8">
              {/* Section 1 */}
              <section>
                <h3 className="text-lg font-bold mb-4">1. Загальна інформація про команду</h3>
                <div className="grid grid-cols-2 gap-4">
                  <InputGroup label="Назва команди" placeholder="Введіть назву вашої команди" />
                  <InputGroup label="Місто/школа/організація (опціонально)" placeholder="Напр. Київ, СШ №100, IT-Club" />
                  <InputGroup label="Місто/школа/організація (опціонально)" placeholder="Напр. Київ, СШ №100, IT-Club" />
                  <InputGroup label="Контактний телеграм/дискорд (опціонально)" placeholder="@username or server-invite" />
                </div>
              </section>

              {/* Section 2 */}
              <section>
                <h3 className="text-lg font-bold mb-4">2. Капітан</h3>
                <div className="grid grid-cols-2 gap-4">
                  <InputGroup label="Капітан (ПІБ)" placeholder="Іванов Іван Іванович" />
                  <InputGroup label="Email капітана" placeholder="captain@example.com" success />
                </div>
              </section>

              {/* Section 3 */}
              <section>
                <div className="mb-4">
                  <h3 className="text-lg font-bold">3. Учасники (Список)</h3>
                  <p className="text-xs text-slate-400">Список учасників (мінімум 2, максимум 10)</p>
                  <p className="text-xs text-slate-400">Рведіть вся яльно турнеру тенастоящм на настройкон турнірум.</p>
                </div>

                <div className="space-y-4">
                  {participants.map((p, idx) => (
                    <div key={p.id} className="grid grid-cols-2 gap-4">
                      <InputGroup label={`Учасник ${idx + 1} (ПІБ)`} placeholder={`Учасник ${idx + 1} (ПІБ)`} />
                      <InputGroup label={`Email ${idx + 1}`} placeholder="captain@example.com" success />
                    </div>
                  ))}
                </div>
              </section>

              {/* Error Message */}
              <div className="bg-red-50 border border-red-200 rounded-lg p-3 flex items-center gap-2 text-red-600">
                <AlertCircle size={18} />
                <span className="text-sm font-medium">Мінімум 2 учасники для реєстрації</span>
              </div>

              {/* Buttons */}
              <div className="flex gap-4 pt-4">
                <button type="submit" className="bg-[#3b82f6] text-white px-6 py-2.5 rounded-lg font-medium hover:bg-blue-700 transition-colors shadow-sm">
                  Створити команду
                </button>
                <button type="button" className="bg-white border border-slate-300 text-slate-600 px-6 py-2.5 rounded-lg font-medium hover:bg-slate-50 transition-colors">
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

// Вспомогательные компоненты
function SidebarItem({ icon, label, active = false }: { icon: React.ReactNode, label: string, active?: boolean }) {
  return (
    <div className={`flex items-center gap-3 px-3 py-2 rounded-lg cursor-pointer transition-colors ${active ? 'bg-blue-50 text-blue-600' : 'text-slate-500 hover:bg-slate-50'}`}>
      {icon}
      <span className="font-medium text-sm">{label}</span>
    </div>
  );
}

function InputGroup({ label, placeholder, success = false }: { label: string, placeholder: string, success?: boolean }) {
  return (
    <div className="flex flex-col gap-1.5">
      <label className="text-sm font-bold text-slate-700">{label}</label>
      <div className="relative">
        <input
          type="text"
          placeholder={placeholder}
          className={`w-full px-4 py-2 border rounded-lg text-sm outline-none transition-all ${success ? 'border-green-500 pr-10' : 'border-slate-300 focus:border-blue-500'}`}
        />
        {success && (
          <div className="absolute right-3 top-1/2 -translate-y-1/2 text-green-500">
            <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" viewBox="0 0 20 20" fill="currentColor">
              <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
            </svg>
          </div>
        )}
      </div>
    </div>
  );
}
