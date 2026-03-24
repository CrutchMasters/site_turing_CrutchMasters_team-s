 import React from 'react';
import { User, Mail, Shield, Users, History, CheckCircle, Clock, XCircle } from 'lucide-react';

export default function UserProfile() {
  return (
    <div className="min-h-screen bg-gray-50 p-8 text-gray-800">
      {/* Хлібні крихти та Заголовок */}
      <header className="mb-8">
        <nav className="text-sm text-gray-500 mb-2">Головна &gt; Профіль користувача</nav>
        <h1 className="text-2xl font-bold text-gray-900">9. Профіль користувача — [Роль: Учасник]</h1>
      </header>

      <div className="max-w-6xl mx-auto space-y-6">
        
        {/* 1. Базова інформація */}
        <section className="bg-white rounded-2xl shadow-sm border border-gray-200 p-6 flex flex-col md:flex-row items-center gap-8 relative overflow-hidden">
          {/* Декоративний фон як на скриншоті */}
          <div className="absolute right-0 top-0 opacity-5 pointer-events-none">
            <Shield size={200} />
          </div>

          <div className="relative">
            <div className="w-32 h-32 rounded-full bg-blue-100 flex items-center justify-center border-4 border-white shadow-md">
              <User size={64} className="text-blue-600" />
            </div>
            <span className="absolute bottom-2 right-2 w-6 h-6 bg-green-500 border-4 border-white rounded-full"></span>
          </div>

          <div className="flex-1 space-y-3">
            <div className="flex justify-between items-start">
              <div>
                <h2 className="text-xl font-bold flex items-center gap-2">
                  1. Базова інформація <span className="text-green-600 text-sm font-medium bg-green-50 px-2 py-1 rounded">[Статус: Активний]</span>
                </h2>
                <div className="mt-4 space-y-1">
                  <p className="flex items-center gap-2"><User size={16} /> <strong>Ім'я:</strong> Антон Петров</p>
                  <p className="flex items-center gap-2"><Mail size={16} /> <strong>Email:</strong> a.petrov@tournament.com</p>
                  <p className="flex items-center gap-2 text-blue-600 font-semibold"><Shield size={16} /> <strong>Роль:</strong> Учасник (Team Lead)</p>
                </div>
              </div>
              <button className="bg-gray-800 text-white px-4 py-2 rounded-lg hover:bg-gray-700 transition-colors">
                Редагувати дані
              </button>
            </div>
            <div className="pt-4 border-t border-gray-100 text-sm text-gray-500">
              Дата реєстрації: 05.02.2023 | Турнір (асоціація): (Всі)
            </div>
          </div>
        </section>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          
          {/* 2a. Склад команди */}
          <section className="bg-white rounded-2xl shadow-sm border border-gray-200 p-6">
            <h2 className="text-lg font-bold mb-4 flex items-center gap-2">
              <Users className="text-blue-600" /> 2a. Склад команди
            </h2>
            <div className="overflow-x-auto">
              <table className="w-full text-left">
                <thead>
                  <tr className="border-b border-gray-100 text-sm text-gray-500">
                    <th className="pb-3 font-medium">Учасник</th>
                    <th className="pb-3 font-medium">Роль</th>
                    <th className="pb-3 font-medium text-right">Дія</th>
                  </tr>
                </thead>
                <tbody className="text-sm">
                  {[
                    { name: "Антон Петров", role: "Team Lead", status: "online" },
                    { name: "Марія Сидоренко", role: "Frontend", status: "online" },
                    { name: "Олег Іванов", role: "UI/UX Designer", status: "away" },
                  ].map((member, i) => (
                    <tr key={i} className="border-b border-gray-50 last:border-0 hover:bg-gray-50 transition-colors">
                      <td className="py-3 flex items-center gap-2">
                        <div className="w-8 h-8 rounded-full bg-gray-200" />
                        {member.name}
                      </td>
                      <td className="py-3">{member.role}</td>
                      <td className="py-3 text-right text-blue-600 cursor-pointer font-medium">Профіль</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <button className="w-full mt-4 py-2 border-2 border-dashed border-gray-200 rounded-xl text-gray-500 hover:bg-gray-50 hover:border-blue-300 hover:text-blue-600 transition-all">
              + Додати учасника
            </button>
          </section>

          {/* 2b. Історія участі та сабмітів */}
          <section className="bg-white rounded-2xl shadow-sm border border-gray-200 p-6">
            <h2 className="text-lg font-bold mb-4 flex items-center gap-2">
              <History className="text-blue-600" /> 2b. Історія сабмітів
            </h2>
            <div className="space-y-4">
              {[
                { task: "Проєкт A - API", status: "success", time: "21.03.2026", color: "text-green-600", Icon: CheckCircle },
                { task: "Frontend Base", status: "pending", time: "20.03.2026", color: "text-blue-600", Icon: Clock },
                { task: "Auth System", status: "failed", time: "18.03.2026", color: "text-red-600", Icon: XCircle },
              ].map((sub, i) => (
                <div key={i} className="flex items-center justify-between p-3 rounded-xl bg-gray-50 hover:shadow-inner transition-all">
                  <div className="flex items-center gap-3">
                    <sub.Icon className={sub.color} size={20} />
                    <div>
                      <p className="font-medium text-sm">{sub.task}</p>
                      <p className="text-xs text-gray-400">{sub.time}</p>
                    </div>
                  </div>
                  <span className={`text-xs font-bold uppercase px-2 py-1 rounded bg-white border border-gray-100 ${sub.color}`}>
                    {sub.status}
                  </span>
                </div>
              ))}
            </div>
            <div className="mt-6 p-4 bg-blue-50 rounded-xl flex items-center justify-between">
              <div>
                <p className="text-xs text-blue-600 uppercase font-bold">Успішність</p>
                <p className="text-2xl font-black text-blue-900">85%</p>
              </div>
              <div className="text-right">
                <p className="text-xs text-gray-500">Всього сабмітів</p>
                <p className="text-lg font-bold">23</p>
              </div>
            </div>
          </section>

        </div>
      </div>

      <footer className="mt-8 text-center text-xs text-gray-400">
        * Профіль оновлено: {new Date().toLocaleTimeString()}
      </footer>
    </div>
  );
}
