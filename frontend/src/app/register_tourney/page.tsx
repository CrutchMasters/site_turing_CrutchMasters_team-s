'use client';

import React from 'react';
import {
    Shield,
    ChevronsLeft,
    LayoutDashboard,
    Trophy,
    Users,
    User,
    Settings,
    LogOut,
    Bold,
    Italic,
    Underline,
    List,
    Quote,
    Type,
    Zap,
    Calendar,
    Clock
} from 'lucide-react';

export default function RegisterTourney() {
    return (
        <div className="flex h-screen bg-[#f4f7f9] text-gray-800 font-sans">
        {/* Sidebar */}
        <aside className="w-64 bg-white border-r border-gray-200 flex flex-col justify-between hidden md:flex">
        <div>
        {/* Logo Area */}
        <div className="h-16 flex items-center px-6 border-b border-gray-100">
        <Shield className="text-blue-500 w-8 h-8" />
        <button className="ml-auto text-gray-400 hover:text-gray-600">
        <ChevronsLeft className="w-5 h-5" />
        </button>
        </div>

        {/* Navigation */}
        <nav className="p-4 space-y-1">
        <a href="#" className="flex items-center px-3 py-2.5 text-sm font-medium text-gray-600 rounded-lg hover:bg-gray-50">
        <LayoutDashboard className="w-5 h-5 mr-3 text-gray-400" />
        Dashboard
        </a>
        <a href="#" className="flex items-center px-3 py-2.5 text-sm font-medium text-blue-700 bg-blue-50 rounded-lg">
        <Trophy className="w-5 h-5 mr-3 text-blue-500" />
        Турніри
        </a>
        <a href="#" className="flex items-center px-3 py-2.5 text-sm font-medium text-gray-600 rounded-lg hover:bg-gray-50">
        <Users className="w-5 h-5 mr-3 text-gray-400" />
        Команди
        </a>
        <a href="#" className="flex items-center px-3 py-2.5 text-sm font-medium text-gray-600 rounded-lg hover:bg-gray-50">
        <User className="w-5 h-5 mr-3 text-gray-400" />
        Гравці
        </a>

        <div className="pt-4">
        <a href="#" className="flex items-center px-3 py-2.5 text-sm font-medium text-gray-600 rounded-lg hover:bg-gray-50">
        <Settings className="w-5 h-5 mr-3 text-gray-400" />
        Налаштування
        </a>
        </div>
        </nav>
        </div>

        {/* Bottom Links */}
        <div className="p-4 border-t border-gray-100 space-y-1">
        <a href="#" className="flex items-center px-3 py-2.5 text-sm font-medium text-gray-600 rounded-lg hover:bg-gray-50">
        <Settings className="w-5 h-5 mr-3 text-gray-400" />
        Налаштування
        </a>
        <a href="#" className="flex items-center px-3 py-2.5 text-sm font-medium text-gray-600 rounded-lg hover:bg-gray-50">
        <LogOut className="w-5 h-5 mr-3 text-gray-400" />
        Logout
        </a>
        </div>
        </aside>

        {/* Main Content */}
        <main className="flex-1 overflow-y-auto">
        <div className="p-8 max-w-5xl mx-auto">

        {/* Page Header */}
        <div className="mb-6">
        <h1 className="text-2xl font-semibold text-gray-800">Створення турніру (Admin)</h1>
        </div>

        {/* Form Card */}
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-8 max-w-3xl">
        <h2 className="text-lg font-bold text-gray-900 mb-6">Створення нового турніру</h2>

        <form className="space-y-8" onSubmit={(e) => e.preventDefault()}>

        {/* Section 1: Загальна інформація */}
        <div>
        <h3 className="text-base font-semibold text-gray-800 mb-4">1. Загальна інформація</h3>

        <div className="space-y-4">
        <div>
        <label htmlFor="name" className="block text-sm font-medium text-gray-700 mb-1">Назва турніру</label>
        <input
        type="text"
        id="name"
        placeholder="Назва турніру (покажчик)"
        className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none text-sm transition-colors"
        />
        </div>

        <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">Опис / Правила</label>
        <div className="border border-gray-300 rounded-lg overflow-hidden focus-within:ring-2 focus-within:ring-blue-500 focus-within:border-blue-500 transition-colors">
        {/* Rich Text Toolbar */}
        <div className="bg-gray-50 border-b border-gray-300 px-3 py-2 flex items-center space-x-1 text-gray-500">
        <button type="button" className="p-1.5 hover:bg-gray-200 rounded text-gray-700"><Bold className="w-4 h-4" /></button>
        <button type="button" className="p-1.5 hover:bg-gray-200 rounded text-gray-700"><Italic className="w-4 h-4" /></button>
        <button type="button" className="p-1.5 hover:bg-gray-200 rounded text-gray-700"><Underline className="w-4 h-4" /></button>
        <button type="button" className="p-1.5 hover:bg-gray-200 rounded text-gray-700 ml-2"><List className="w-4 h-4" /></button>
        <button type="button" className="p-1.5 hover:bg-gray-200 rounded text-gray-700"><Quote className="w-4 h-4" /></button>
        <button type="button" className="p-1.5 hover:bg-gray-200 rounded text-gray-700"><Type className="w-4 h-4" /></button>
        </div>
        <textarea
        rows={4}
        className="w-full px-4 py-3 outline-none resize-y text-sm text-gray-700"
        placeholder="Введіть опис турніру..."
        ></textarea>
        </div>
        </div>
        </div>
        </div>

        {/* Section 2: Час та Умови */}
        <div>
        <h3 className="text-base font-semibold text-gray-800 mb-4">2. Час та Умови</h3>

        <div className="space-y-4">
        {/* Start Date */}
        <div>
        <div className="flex justify-between items-center mb-1">
        <label htmlFor="start_date" className="block text-sm font-medium text-gray-700">Дата та час старту турніру</label>
        <span className="text-xs text-red-500 font-medium flex items-center">
        <Zap className="w-3 h-3 mr-1 fill-red-500" />
        Обов'язково
        </span>
        </div>
        <div className="relative">
        {/* Використовуємо datetime-local, браузер сам додає іконки календаря/годинника, але можна стилізувати */}
        <input
        type="datetime-local"
        id="start_date"
        className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none text-sm text-gray-600"
        />
        </div>
        </div>

        {/* Registration Window */}
        <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">Вікно реєстрації команд</label>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="relative">
        <input
        type="datetime-local"
        className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none text-sm text-gray-600"
        />
        </div>
        <div className="relative">
        <input
        type="datetime-local"
        className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none text-sm text-gray-600"
        />
        </div>
        </div>
        </div>

        {/* Max Teams */}
        <div>
        <div className="flex justify-between items-center mb-1">
        <label htmlFor="max_teams" className="block text-sm font-medium text-gray-700">Максимальна кількість команд</label>
        <span className="text-xs text-gray-500">(Опціонально)</span>
        </div>
        <input
        type="number"
        id="max_teams"
        placeholder="0"
        className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none text-sm text-gray-700"
        />
        </div>
        </div>
        </div>

        {/* Section 3: Формат */}
        <div>
        <h3 className="text-base font-semibold text-gray-800 mb-4">3. Формат</h3>

        <div>
        <label htmlFor="rounds" className="block text-sm font-medium text-gray-700 mb-1">
        Кількість раундів <span className="text-gray-400 font-normal">(Мінімально - 1)</span>
        </label>
        <select
        id="rounds"
        className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none text-sm text-gray-700 bg-white"
        >
        <option value="" disabled selected>Choice a ...</option>
        <option value="1">1 раунд</option>
        <option value="3">3 раунди (Bo3)</option>
        <option value="5">5 раундів (Bo5)</option>
        </select>
        </div>
        </div>

        {/* Action Buttons */}
        <div className="pt-4 flex items-center space-x-3">
        <button
        type="submit"
        className="px-6 py-2.5 bg-[#2d63c8] hover:bg-blue-700 text-white text-sm font-medium rounded-lg transition-colors"
        >
        Створити турнір
        </button>
        <button
        type="button"
        className="px-6 py-2.5 bg-white border border-gray-300 hover:bg-gray-50 text-gray-700 text-sm font-medium rounded-lg transition-colors"
        >
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
