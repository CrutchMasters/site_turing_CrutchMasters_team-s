'use client';
import React, { useState } from 'react';
import {
  Bold, Italic, Underline, List, Quote, Type, Zap
} from 'lucide-react';

import Sidebar from "@/components/Sidebar";
import MobileHeader from "@/components/MobileHeader";
import { useTheme } from "@/hooks/useTheme";
import { useT } from "@/context/LanguageContext";

export default function RegisterTourney() {
  const { dark } = useTheme();
  const { t } = useT();
  const [isMobileSidebarOpen, setIsMobileSidebarOpen] = useState(false);

  return (
    <div className="flex h-screen bg-(--bg) text-(--t1) font-sans transition-colors">

      {/* Sidebar */}
      <div className={`fixed inset-y-0 left-0 z-50 lg:relative transition-transform duration-300 
        ${isMobileSidebarOpen ? "translate-x-0" : "-translate-x-full lg:translate-x-0"}`}>
        <Sidebar />
      </div>

      {/* Overlay */}
      {isMobileSidebarOpen && (
        <div
          className="fixed inset-0 bg-black/50 backdrop-blur-sm z-40 lg:hidden"
          onClick={() => setIsMobileSidebarOpen(false)}
        />
      )}

      {/* Main */}
      <main className="flex-1 overflow-y-auto">
        <MobileHeader
          onOpenSidebar={() => setIsMobileSidebarOpen(true)}
          title={t.tourney?.create || "Створення турніру"}
        />

        <div className="p-6 md:p-10 max-w-5xl mx-auto">

          {/* Header */}
          <div className="mb-6">
            <h1 className="text-2xl font-semibold">
              {t.tourney?.createAdmin || "Створення турніру (Admin)"}
            </h1>
          </div>

          {/* Card */}
          <div className="bg-(--card) rounded-xl shadow-sm border border-(--brd) p-8 max-w-3xl">

            <h2 className="text-lg font-bold mb-6">
              {t.tourney?.createNew || "Створення нового турніру"}
            </h2>

            <form className="space-y-8" onSubmit={(e) => e.preventDefault()}>

              {/* SECTION 1 */}
              <div>
                <h3 className="text-base font-semibold mb-4">
                  1. {t.tourney?.general || "Загальна інформація"}
                </h3>

                <div className="space-y-4">

                  {/* Name */}
                  <div>
                    <label className="block text-sm font-medium mb-1 text-(--t2)">
                      {t.tourney?.name || "Назва турніру"}
                    </label>
                    <input
                      type="text"
                      placeholder={t.tourney?.namePlaceholder || "Назва турніру (покажчик)"}
                      className="w-full px-4 py-2 border border-(--brd) rounded-lg 
                      focus:ring-2 focus:ring-blue-500 outline-none text-sm bg-(--bg)"
                    />
                  </div>

                  {/* Description */}
                  <div>
                    <label className="block text-sm font-medium mb-1 text-(--t2)">
                      {t.tourney?.desc || "Опис / Правила"}
                    </label>

                    <div className="border border-(--brd) rounded-lg overflow-hidden focus-within:ring-2 focus-within:ring-blue-500">

                      {/* Toolbar */}
                      <div className="bg-(--bg) border-b border-(--brd) px-3 py-2 flex items-center space-x-1">
                        <button type="button" className="p-1.5 hover:bg-(--card) rounded">
                          <Bold className="w-4 h-4" />
                        </button>
                        <button type="button" className="p-1.5 hover:bg-(--card) rounded">
                          <Italic className="w-4 h-4" />
                        </button>
                        <button type="button" className="p-1.5 hover:bg-(--card) rounded">
                          <Underline className="w-4 h-4" />
                        </button>
                        <button type="button" className="p-1.5 hover:bg-(--card) rounded ml-2">
                          <List className="w-4 h-4" />
                        </button>
                        <button type="button" className="p-1.5 hover:bg-(--card) rounded">
                          <Quote className="w-4 h-4" />
                        </button>
                        <button type="button" className="p-1.5 hover:bg-(--card) rounded">
                          <Type className="w-4 h-4" />
                        </button>
                      </div>

                      <textarea
                        rows={4}
                        placeholder={t.tourney?.descPlaceholder || "Введіть опис турніру..."}
                        className="w-full px-4 py-3 outline-none resize-y text-sm bg-transparent"
                      />
                    </div>
                  </div>

                </div>
              </div>

              {/* SECTION 2 */}
              <div>
                <h3 className="text-base font-semibold mb-4">
                  2. {t.tourney?.time || "Час та Умови"}
                </h3>

                <div className="space-y-4">

                  {/* Start */}
                  <div>
                    <div className="flex justify-between items-center mb-1">
                      <label className="text-sm font-medium text-(--t2)">
                        {t.tourney?.start || "Дата та час старту турніру"}
                      </label>

                      <span className="text-xs text-red-500 flex items-center">
                        <Zap className="w-3 h-3 mr-1 fill-red-500" />
                        {t.common?.required || "Обов'язково"}
                      </span>
                    </div>

                    <input
                      type="datetime-local"
                      className="w-full px-4 py-2 border border-(--brd) rounded-lg text-sm bg-(--bg)"
                    />
                  </div>

                  {/* Registration window */}
                  <div>
                    <label className="block text-sm font-medium mb-1 text-(--t2)">
                      {t.tourney?.registration || "Вікно реєстрації команд"}
                    </label>

                    <div className="grid md:grid-cols-2 gap-4">
                      <input type="datetime-local"
                        className="px-4 py-2 border border-(--brd) rounded-lg bg-(--bg)" />
                      <input type="datetime-local"
                        className="px-4 py-2 border border-(--brd) rounded-lg bg-(--bg)" />
                    </div>
                  </div>

                  {/* Max teams */}
                  <div>
                    <div className="flex justify-between mb-1">
                      <label className="text-sm font-medium text-(--t2)">
                        {t.tourney?.maxTeams || "Максимальна кількість команд"}
                      </label>
                      <span className="text-xs text-(--t2)">
                        ({t.common?.optional || "Опціонально"})
                      </span>
                    </div>

                    <input
                      type="number"
                      placeholder="0"
                      className="w-full px-4 py-2 border border-(--brd) rounded-lg bg-(--bg)"
                    />
                  </div>

                </div>
              </div>

              {/* SECTION 3 */}
              <div>
                <h3 className="text-base font-semibold mb-4">
                  3. {t.tourney?.format || "Формат"}
                </h3>

                <div>
                  <label className="block text-sm font-medium mb-1 text-(--t2)">
                    {t.tourney?.rounds || "Кількість раундів"}{" "}
                    <span className="text-(--t2)">
                      ({t.tourney?.min1 || "Мінімально - 1"})
                    </span>
                  </label>

                  <select className="w-full px-4 py-2 border border-(--brd) rounded-lg bg-(--bg)">
                    <option disabled selected>
                      {t.common?.choose || "Обрати..."}
                    </option>
                    <option value="1">1 раунд</option>
                    <option value="3">3 раунди (Bo3)</option>
                    <option value="5">5 раундів (Bo5)</option>
                  </select>
                </div>
              </div>

              {/* Buttons */}
              <div className="pt-4 flex gap-3">
                <button className="px-6 py-2.5 bg-blue-600 hover:bg-blue-700 text-white text-sm font-medium rounded-lg">
                  {t.tourney?.createBtn || "Створити турнір"}
                </button>

                <button className="px-6 py-2.5 bg-(--bg) border border-(--brd) text-(--t2) rounded-lg">
                  {t.common?.cancel || "Скасувати"}
                </button>
              </div>

            </form>
          </div>
        </div>
      </main>
    </div>
  );
}
