"use client";

import Link from "next/link";

export default function LoginPage() {
    return (
        <div className="min-h-screen bg-[#f3f4f6] flex flex-col items-center justify-center font-sans text-slate-900 relative overflow-hidden">

        {/* --- СЕРЫЙ ЛОГОТИП-ЩИТ НА ФОНЕ (СТИЛЬ ГЛАВНОЙ) --- */}
        <div className="absolute inset-0 flex items-center justify-center opacity-[0.03] pointer-events-none z-0">
        <svg width="800" height="800" viewBox="0 0 24 24" fill="currentColor" className="text-gray-900">
        <path d="M12 1L3 5v6c0 5.55 3.84 10.74 9 12 5.16-1.26 9-6.45 9-12V5l-9-4z" />
        </svg>
        </div>

        {/* --- КОНТЕЙНЕР ФОРМЫ --- */}
        <div className="z-10 w-full max-w-md bg-white/80 backdrop-blur-xl p-10 rounded-3xl shadow-2xl border border-white/50 flex flex-col items-center">

        {/* Название проекта */}
        <h1 className="text-4xl font-black text-gray-800 mb-8 tracking-tighter uppercase">
        Code Future
        </h1>

        <form className="w-full flex flex-col gap-5">
        {/* Поле Gmail / Login */}
        <div className="flex flex-col gap-1">
        <input
        type="text"
        placeholder="gmail / login ..."
        className="w-full px-5 py-3 rounded-lg border border-gray-300 bg-white focus:ring-2 focus:ring-blue-600 outline-none transition-all placeholder:italic text-sm"
        required
        />
        </div>

        {/* Поле Password */}
        <div className="flex flex-col gap-1">
        <input
        type="password"
        placeholder="password ..."
        className="w-full px-5 py-3 rounded-lg border border-gray-300 bg-white focus:ring-2 focus:ring-blue-600 outline-none transition-all placeholder:italic text-sm"
        required
        />
        </div>

        {/* Кнопка Sign In */}
        <button
        type="submit"
        className="w-full mt-2 bg-blue-600 text-white py-4 rounded-lg text-2xl font-bold shadow-md hover:bg-blue-700 transition-all active:scale-[0.98] uppercase tracking-tight"
        >
        Sign In
        </button>
        </form>

        {/* --- НАДПИСЬ DON'T HAVE AN ACCOUNT? --- */}
        <div className="mt-8 text-center text-sm">
        <span className="text-gray-400 font-medium italic">Don&apos;t have an account? </span>
        <Link href="/register" className="text-blue-600 font-bold hover:underline ml-1">
        sign up
        </Link>
        </div>
        </div>

        {/* Кнопка возврата на главную */}
        <Link href="/" className="absolute top-8 left-8 text-gray-400 hover:text-blue-600 text-xs font-bold uppercase tracking-widest transition-colors flex items-center gap-2">
        <span>←</span> Back to home
        </Link>
        </div>
    );
}
