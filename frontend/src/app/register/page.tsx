"use client";

import Link from "next/link";
import { useState, ChangeEvent, FormEvent, useEffect, useRef } from "react";
import { useLanguage } from "@/context/LanguageContext";

// Основной компонент ДОЛЖЕН иметь export default
export default function RegisterPage() {
  const { t } = useLanguage();

  const [formData, setFormData] = useState({
    username: "",
    login: "",
    email: "",
    password: "",
    confirmPassword: ""
  });
  const [agreed, setAgreed] = useState(false);
  const cardRef = useRef<HTMLDivElement>(null);

  const isPasswordMatch = formData.password === formData.confirmPassword;
  const passwordsNotEmpty = formData.password.length > 0;
  const canSubmit = agreed && isPasswordMatch && passwordsNotEmpty;

  useEffect(() => {
    if (cardRef.current) {
      setTimeout(() => {
        cardRef.current?.classList.add("opacity-100", "translate-y-0");
        cardRef.current?.classList.remove("opacity-0", "-translate-y-10");
      }, 100);
    }
  }, []);

  const handleChange = (e: ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target;
    setFormData((prev) => ({ ...prev, [name]: value }));
  };

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (canSubmit) {
      try {
        // Убедись, что FastAPI запущен на порту 8000
        const response = await fetch("http://127.0.0.1:8000/api/register", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            username: formData.username,
            login: formData.login,
            email: formData.email,
            password: formData.password, // Поле из account.csv
          }),
        });

        const data = await response.json();

        if (response.ok) {
          alert("Регистрация успешна!");
        } else {
          alert(`Ошибка: ${data.detail || "Не удалось сохранить пользователя"}`);
        }
      } catch (error) {
        console.error("Ошибка сети:", error);
        alert("Ошибка соединения с сервером.");
      }
    }
  };

  return (
    <div className="min-h-screen bg-[#f3f4f6] flex flex-col items-center justify-center font-sans text-slate-900 relative overflow-hidden">
    {/* В Next.js лучше не использовать <style jsx global> внутри серверных компонентов,
      но так как у нас 'use client', это допустимо.
      Убедись, что библиотека 'styled-jsx' установлена, или вынеси это в Tailwind/CSS.
      */}
      <style jsx global>{`
        .reveal-drop {
          transition: all 0.8s cubic-bezier(0.22, 1, 0.36, 1);
        }
        `}</style>

        <div className="absolute inset-0 flex items-center justify-center opacity-10 pointer-events-none">
        <img src="/logo_backround1.svg" alt="Watermark" className="w-[800px] h-[800px] object-contain" />
        </div>

        <Link
        href="/"
        className="absolute top-8 left-8 text-gray-400 hover:text-blue-600 text-xs font-black uppercase tracking-[0.3em] transition-all flex items-center gap-2 group z-20"
        >
        <span className="group-hover:-translate-x-1 transition-transform">←</span> {t.nav.backHome}
        </Link>

        <div
        ref={cardRef}
        className="reveal-drop opacity-0 -translate-y-10 z-10 w-full max-w-md bg-white/70 backdrop-blur-2xl p-10 rounded-[2.5rem] shadow-2xl shadow-blue-900/5 border border-white/50 flex flex-col items-center"
        >
        <h1 className="text-4xl font-black text-gray-800 mb-8 tracking-tighter uppercase text-center">
        {t.auth.registerTitle}
        </h1>

        <form onSubmit={handleSubmit} className="w-full flex flex-col gap-4">
        <input
        name="username"
        type="text"
        placeholder={t.auth.username}
        value={formData.username}
        onChange={handleChange}
        className="w-full px-5 py-4 rounded-2xl border border-gray-200 bg-white/50 focus:ring-2 focus:ring-blue-500 focus:bg-white outline-none transition-all placeholder:italic text-sm"
        required
        />
        <input
        name="login"
        type="text"
        placeholder={t.auth.login}
        value={formData.login} // Соответствует колонке в account.csv
        onChange={handleChange}
        className="w-full px-5 py-4 rounded-2xl border border-gray-200 bg-white/50 focus:ring-2 focus:ring-blue-500 focus:bg-white outline-none transition-all placeholder:italic text-sm"
        required
        />
        <input
        name="email"
        type="email"
        placeholder={t.auth.email}
        value={formData.email}
        onChange={handleChange}
        className="w-full px-5 py-4 rounded-2xl border border-gray-200 bg-white/50 focus:ring-2 focus:ring-blue-500 focus:bg-white outline-none transition-all placeholder:italic text-sm"
        required
        />
        <div className="grid grid-cols-2 gap-3">
        <input
        name="password"
        type="password"
        placeholder={t.auth.password}
        value={formData.password}
        onChange={handleChange}
        className="w-full px-4 py-4 rounded-2xl border border-gray-200 bg-white/50 focus:ring-2 focus:ring-blue-500 focus:bg-white outline-none transition-all placeholder:italic text-sm"
        required
        />
        <input
        name="confirmPassword"
        type="password"
        placeholder={t.auth.confirmPassword}
        value={formData.confirmPassword}
        onChange={handleChange}
        className={`w-full px-4 py-4 rounded-2xl border bg-white/50 focus:ring-2 outline-none transition-all placeholder:italic text-sm ${
          !isPasswordMatch && formData.confirmPassword ? "border-red-500 focus:ring-red-500" : "border-gray-200 focus:ring-blue-500"
        }`}
        required
        />
        </div>

        <div className="flex items-center gap-3 py-2">
        <input
        type="checkbox"
        id="privacy"
        checked={agreed}
        onChange={() => setAgreed(!agreed)}
        className="w-5 h-5 cursor-pointer accent-blue-600 rounded-lg border-gray-300 transition-all"
        />
        <label htmlFor="privacy" className="text-[11px] font-bold text-gray-500 cursor-pointer select-none uppercase tracking-wider">
        {t.auth.privacy}
        </label>
        </div>

        <button
        type="submit"
        disabled={!canSubmit}
        className={`w-full py-5 rounded-[2rem] text-xl font-black shadow-xl transition-all active:scale-95 uppercase tracking-tighter ${
          canSubmit
          ? "bg-blue-600 text-white hover:bg-blue-700 shadow-blue-200"
          : "bg-gray-200 text-gray-400 cursor-not-allowed"
        }`}
        >
        {t.auth.registerBtn}
        </button>
        </form>
        </div>
        </div>
  );
}
