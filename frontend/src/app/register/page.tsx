"use client";

import Link from "next/link";
import { useState } from "react";

export default function RegisterPage() {
  const [agreed, setAgreed] = useState(false);

  return (
    <div className="min-h-screen bg-[#f3f4f6] flex flex-col items-center justify-center font-sans text-slate-900 relative overflow-hidden">

    {/* --- ТОТ САМЫЙ СЕРЫЙ ЛОГОТИП НА ФОНЕ (КОНТУР ЩИТА) --- */}
    <div className="absolute inset-0 flex items-center justify-center opacity-[0.03] pointer-events-none z-0">
    <svg width="800" height="800" viewBox="0 0 24 24" fill="currentColor" className="text-gray-900">
    <path d="M12 1L3 5v6c0 5.55 3.84 10.74 9 12 5.16-1.26 9-6.45 9-12V5l-9-4z" />
    </svg>
    </div>

    {/* --- КОНТЕЙНЕР ФОРМЫ (ПО РИСУНКУ) --- */}
    <div className="z-10 w-full max-w-md bg-white/80 backdrop-blur-xl p-10 rounded-3xl shadow-2xl border border-white/50 flex flex-col items-center">

    {/* Название проекта */}
    <h1 className="text-4xl font-black text-gray-800 mb-8 tracking-tighter uppercase">
    Code Future
    </h1>

    <form className="w-full flex flex-col gap-4">
    {/* Username */}
    <input
    type="text"
    placeholder="username ..."
    className="w-full px-5 py-3 rounded-lg border border-gray-300 bg-white focus:ring-2 focus:ring-blue-500 outline-none transition-all placeholder:italic"
    required
    />

    {/* Login */}
    <input
    type="text"
    placeholder="login ..."
    className="w-full px-5 py-3 rounded-lg border border-gray-300 bg-white focus:ring-2 focus:ring-blue-500 outline-none transition-all placeholder:italic"
    required
    />

    {/* Gmail */}
    <input
    type="email"
    placeholder="gmail ..."
    className="w-full px-5 py-3 rounded-lg border border-gray-300 bg-white focus:ring-2 focus:ring-blue-500 outline-none transition-all placeholder:italic"
    required
    />

    {/* Password */}
    <input
    type="password"
    placeholder="password ..."
    className="w-full px-5 py-3 rounded-lg border border-gray-300 bg-white focus:ring-2 focus:ring-blue-500 outline-none transition-all placeholder:italic"
    required
    />

    {/* Галочка Privacy Policy */}
    <div className="flex items-center gap-3 py-2">
    <input
    type="checkbox"
    id="privacy"
    checked={agreed}
    onChange={() => setAgreed(!agreed)}
    className="w-5 h-5 cursor-pointer accent-blue-600"
    />
    <label htmlFor="privacy" className="text-sm text-gray-600 cursor-pointer select-none">
    Privacy Policy
    </label>
    </div>

    {/* Кнопка Registered */}
    <button
    type="submit"
    disabled={!agreed}
    className="w-full bg-blue-600 text-white py-4 rounded-lg text-2xl font-bold shadow-md hover:bg-blue-700 transition-all active:scale-[0.98] disabled:opacity-50 disabled:grayscale"
    >
    Registered
    </button>
    </form>

    {/* --- НАДПИСЬ SIGN IN (ИСПРАВЛЕННАЯ) --- */}
    <div className="mt-6 text-center">
    <span className="text-gray-400 font-medium italic">Already have an account? </span>
    <Link href="/login" className="text-blue-600 font-bold hover:underline ml-1">
    sign in
    </Link>
    </div>
    </div>

    {/* Кнопка возврата */}
    <Link href="/" className="absolute top-8 left-8 text-gray-400 hover:text-gray-600 text-xs font-bold uppercase tracking-widest transition-colors">
    ← Back to main
    </Link>
    </div>
  );
}
