"use client";

import Link from "next/link";
import { useEffect, useRef, useState, FormEvent } from "react";
import { useLanguage } from "@/context/LanguageContext";

const API_URL =
typeof window !== "undefined" && window.location.hostname === "localhost"
? "http://localhost:8000"
: "https://site-turing-crutchmasters-team-s.onrender.com";

export default function LoginPage() {
  const { t } = useLanguage();
  const cardRef = useRef<HTMLDivElement>(null);

  const [login, setLogin] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    if (cardRef.current) {
      setTimeout(() => {
        cardRef.current?.classList.add("opacity-100", "translate-y-0");
        cardRef.current?.classList.remove("opacity-0", "-translate-y-10");
      }, 100);
    }
  }, []);

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setError("");
    setLoading(true);

    try {
      const res = await fetch(`${API_URL}/api/login`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ login, password }),
      });

      const data = await res.json();

      if (!res.ok) {
        setError(data.detail || "Login failed");
        return;
      }

      // Зберігаємо токен у localStorage
      localStorage.setItem("access_token", data.access_token);
      localStorage.setItem("user", JSON.stringify(data.user));

      window.location.href = "/main_page";
    } catch {
      setError("Server connection error");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#f3f4f6] flex flex-col items-center justify-center font-sans text-slate-900 relative overflow-hidden">

    <style jsx global>{`
      .reveal-drop {
        transition: all 0.8s cubic-bezier(0.22, 1, 0.36, 1);
      }
      `}</style>

      {/* Фоновый логотип (водяной знак) */}
      <div className="fixed inset-0 flex items-center justify-center opacity-10 pointer-events-none z-0">
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

      <form onSubmit={handleSubmit} className="w-full flex flex-col gap-4">
      {/* Поле Login */}
      <input
      type="text"
      placeholder={t.auth.login}
      value={login}
      onChange={(e) => setLogin(e.target.value)}
      className="w-full px-5 py-4 rounded-2xl border border-gray-200 bg-white/50 focus:ring-2 focus:ring-blue-500 focus:bg-white outline-none transition-all placeholder:italic text-sm"
      required
      />

      {/* Поле Password */}
      <input
      type="password"
      placeholder={t.auth.password}
      value={password}
      onChange={(e) => setPassword(e.target.value)}
      className="w-full px-5 py-4 rounded-2xl border border-gray-200 bg-white/50 focus:ring-2 focus:ring-blue-500 focus:bg-white outline-none transition-all placeholder:italic text-sm"
      required
      />

      {/* Помилка */}
      {error && (
        <p className="text-red-500 text-xs font-bold uppercase tracking-wide text-center">
        {error}
        </p>
      )}

      {/* Кнопка Sign In */}
      <button
      type="submit"
      disabled={loading || !login || !password}
      className={`w-full mt-4 py-5 rounded-[2rem] text-xl font-black shadow-xl transition-all active:scale-95 uppercase tracking-tighter ${
        loading || !login || !password
        ? "bg-gray-200 text-gray-400 cursor-not-allowed"
        : "bg-blue-600 text-white hover:bg-blue-700 shadow-blue-200"
      }`}
      >
      {loading ? "..." : t.auth.loginBtn}
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
