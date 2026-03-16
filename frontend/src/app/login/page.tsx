"use client";

import Link from "next/link";
import { useEffect, useRef } from "react";
// Подключаем хук для мультиязычности
import { useLanguage } from "@/context/LanguageContext";

export default function LoginPage() {
  const { t } = useLanguage(); // Достаем объект с переводами
  const cardRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    // Анимация появления карточки в стиле Plasma
    if (cardRef.current) {
      setTimeout(() => {
        cardRef.current?.classList.add("opacity-100", "translate-y-0");
        cardRef.current?.classList.remove("opacity-0", "-translate-y-10");
      }, 100);
    }
  }, []);

  return (
    <div className="min-h-screen bg-[#f3f4f6] flex flex-col items-center justify-center font-sans text-slate-900 relative overflow-hidden">

      <style jsx global>{`
        .reveal-drop {
          transition: all 0.8s cubic-bezier(0.22, 1, 0.36, 1);
        }
      `}</style>

      {/* Фоновый логотип (водяной знак) */}
      <div className="absolute inset-0 flex items-center justify-center opacity-10 pointer-events-none">
        <img
          src="/logo_backround1.svg"
          alt="Watermark"
          className="w-[800px] h-[800px] object-contain"
        />
      </div>

      {/* Кнопка возврата в стиле Plasma */}
      <Link 
        href="/" 
        className="absolute top-8 left-8 text-gray-400 hover:text-blue-600 text-xs font-black uppercase tracking-[0.3em] transition-all flex items-center gap-2 group z-20"
      >
        <span className="group-hover:-translate-x-1 transition-transform">←</span> {t.nav.backHome}
      </Link>

      {/* --- КОНТЕЙНЕР ФОРМЫ (KDE PLASMA STYLE) --- */}
      <div
        ref={cardRef}
        className="reveal-drop opacity-0 -translate-y-10 z-10 w-full max-w-md bg-white/70 backdrop-blur-2xl p-10 rounded-[2.5rem] shadow-2xl shadow-blue-900/5 border border-white/50 flex flex-col items-center"
      >

        {/* Название проекта */}
        <h1 className="text-4xl font-black text-gray-800 mb-10 tracking-tighter uppercase text-center">
          {t.auth.loginTitle}
        </h1>

        <form className="w-full flex flex-col gap-4">
          {/* Поле Gmail / Login */}
          <input
            type="text"
            placeholder={t.auth.login}
            className="w-full px-5 py-4 rounded-2xl border border-gray-200 bg-white/50 focus:ring-2 focus:ring-blue-500 focus:bg-white outline-none transition-all placeholder:italic text-sm"
            required
          />

          {/* Поле Password */}
          <input
            type="password"
            placeholder={t.auth.password}
            className="w-full px-5 py-4 rounded-2xl border border-gray-200 bg-white/50 focus:ring-2 focus:ring-blue-500 focus:bg-white outline-none transition-all placeholder:italic text-sm"
            required
          />

          {/* Кнопка Sign In */}
          <button
            type="submit"
            className="w-full mt-4 bg-blue-600 text-white py-5 rounded-[2rem] text-xl font-black shadow-xl shadow-blue-200 hover:bg-blue-700 transition-all active:scale-95 uppercase tracking-tighter"
          >
            {t.auth.loginBtn}
          </button>
        </form>

        {/* --- ССЫЛКА НА РЕГИСТРАЦИЮ --- */}
        <div className="mt-10 text-center">
          <span className="text-gray-400 text-xs font-bold uppercase tracking-widest">
            {t.auth.noAccount}{" "}
          </span>
          <Link 
            href="/register" 
            className="text-blue-600 font-black hover:underline ml-1 uppercase text-xs tracking-widest"
          >
            {t.auth.toSignUp}
          </Link>
        </div>
      </div>
    </div>
  );
}
