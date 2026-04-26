//site_turing_CrutchMasters_team-s/frontend/src/app/login/page.tsx
"use client";

import Link from "next/link";
import { useEffect, useRef, useState, FormEvent } from "react";
import { Settings } from "lucide-react";
import { useLanguage } from "@/context/LanguageContext";
import { useTheme } from "@/hooks/useTheme";
import { useRouter } from "next/navigation";
import { useAuth } from "@/context/AuthContext";

const API_URL =
typeof window !== "undefined" && window.location.hostname === "localhost"
? "http://localhost:8000"
: "https://site-turing-crutchmasters-team-s.onrender.com";

export default function LoginPage() {
  const { t, locale, setLocale } = useLanguage();
  const { dark, toggle } = useTheme();
  const router = useRouter();
  const cardRef = useRef<HTMLDivElement>(null);
  const settingsRef = useRef<HTMLDivElement>(null);
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);

  const { login: authLogin } = useAuth();

  const [loginInput, setLoginInput] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
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
      const response = await fetch(`${API_URL}/api/login`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ login: loginInput, password }),
      });

      const data = await response.json();

      if (!response.ok) {
        setError(data.detail || "Login failed");
        setLoading(false);
        return;
      }

      const token = data.access_token;
      const userData = data.user;

      console.log("Login successful");
      console.log("Username:", userData.username);
      console.log("Role:", userData.role);
      console.log("Email:", userData.email);
      console.log("ID:", userData.id);

      localStorage.setItem("access_token", token);
      localStorage.setItem("user", JSON.stringify(userData));
      document.cookie = `access_token=${token}; path=/; max-age=604800`;

      authLogin(userData, token, data.refresh_token);

      router.push("/dashboard");
    } catch (err) {
      console.error("Login error:", err);
      setError("Server connection error");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-(--bg) flex flex-col items-center justify-center font-sans text-(--t1) relative overflow-hidden transition-colors duration-300">
    <style jsx global>{`
      .reveal-drop {
        transition: all 0.8s cubic-bezier(0.22, 1, 0.36, 1);
      }
      `}</style>

      <div
      className={`fixed inset-0 flex items-center justify-center pointer-events-none z-0 transition-opacity ${
        dark ? "opacity-10" : "opacity-5"
      }`}
      >
      <img
      src="/logo_background1.png"
      alt=""
      className={`w-[min(800px,90vw)] h-[min(800px,90vw)] object-contain blur-sm ${
        dark ? "invert" : ""
      }`}
      />
      </div>

      <Link
      href="/"
      className="absolute top-6 left-6 sm:top-8 sm:left-8 text-(--t2) hover:text-blue-600 text-xs font-black uppercase tracking-[0.3em] transition-all flex items-center gap-2 group z-20"
      >
      <span className="group-hover:-translate-x-1 transition-transform">←</span>{" "}
      {t.nav.backHome}
      </Link>

      <div
      ref={cardRef}
      className="reveal-drop opacity-0 -translate-y-10 z-10 w-full max-w-sm mx-4 bg-(--card)/70 backdrop-blur-2xl p-8 sm:p-10 rounded-[2rem] sm:rounded-[2.5rem] shadow-2xl border border-(--brd)"
      >
      <h1 className="text-3xl sm:text-4xl font-black text-(--t1) mb-8 tracking-tighter uppercase text-center">
      {t.auth.loginTitle}
      </h1>

      <form onSubmit={handleSubmit} className="w-full flex flex-col gap-4">
      <input
      type="text"
      placeholder={t.auth.login}
      value={loginInput}
      onChange={(e) => setLoginInput(e.target.value)}
      className="w-full px-5 py-4 rounded-2xl border border-(--brd) bg-(--bg)/50 text-(--t1) focus:ring-2 focus:ring-blue-500 focus:bg-(--card) outline-none transition-all placeholder:italic text-sm"
      required
      />

      <div className="relative">
      <input
      type={showPassword ? "text" : "password"}
      placeholder={t.auth.password}
      value={password}
      onChange={(e) => setPassword(e.target.value)}
      className="w-full px-5 py-4 pr-12 rounded-2xl border border-(--brd) bg-(--bg)/50 text-(--t1) focus:ring-2 focus:ring-blue-500 focus:bg-(--card) outline-none transition-all placeholder:italic text-sm"
      required
      />
      <button
      type="button"
      onClick={() => setShowPassword(!showPassword)}
      className="absolute right-4 top-1/2 -translate-y-1/2 text-(--t2) hover:text-blue-500 transition-colors"
      >
      {showPassword ? (
        <svg
        className="w-5 h-5"
        fill="none"
        stroke="currentColor"
        viewBox="0 0 24 24"
        >
        <path
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth="2"
        d="M13.875 18.825A10.05 10.05 0 0112 19c-4.478 0-8.268-2.943-9.543-7a9.97 9.97 0 011.563-3.029m5.858.908a3 3 0 114.243 4.243M9.878 9.878l4.242 4.242M9.88 9.88l-3.29-3.29m7.532 7.532l3.29 3.29M3 12a9 9 0 1118 0m0 0a9 9 0 01-18 0m0 0a9 9 0 0118 0"
        />
        </svg>
      ) : (
        <svg
        className="w-5 h-5"
        fill="none"
        stroke="currentColor"
        viewBox="0 0 24 24"
        >
        <path
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth="2"
        d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"
        />
        <path
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth="2"
        d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z"
        />
        </svg>
      )}
      </button>
      </div>

      {error && (
        <p className="text-red-500 text-xs font-bold uppercase tracking-wide text-center">
        {error}
        </p>
      )}

      <button
      type="submit"
      disabled={loading || !loginInput || !password}
      className={`w-full mt-2 py-5 rounded-[2rem] text-lg sm:text-xl font-black shadow-xl transition-all active:scale-95 uppercase tracking-tighter ${
        loading || !loginInput || !password
        ? "bg-(--brd) text-(--t2) cursor-not-allowed"
        : "bg-blue-600 text-white hover:bg-blue-700 shadow-blue-500/20"
      }`}
      >
      {loading ? "..." : t.auth.loginBtn}
      </button>
      </form>

      <div className="mt-8 text-center">
      <span className="text-(--t2) text-xs font-bold uppercase tracking-widest">
      {t.auth.noAccount}
      </span>
      <Link
      href="/register"
      className="text-blue-600 font-black hover:underline ml-1 uppercase text-xs tracking-widest"
      >
      {t.auth.toSignUp}
      </Link>
      </div>
      </div>

      {/* SETTINGS BUTTON */}
      <div className="fixed bottom-4 right-4 sm:bottom-6 sm:right-6 z-[60]" ref={settingsRef}>
        <div
          className={`
            absolute bottom-16 right-0
            w-[calc(100vw-2rem)] max-w-[16rem]
            bg-(--card)/90 backdrop-blur-2xl rounded-3xl shadow-2xl border border-(--brd) p-5
            transition-all duration-300 origin-bottom-right
            ${isSettingsOpen
              ? "opacity-100 scale-100 translate-y-0"
              : "opacity-0 scale-95 translate-y-4 pointer-events-none"
            }
          `}
        >
          <h3 className="text-xs font-black uppercase tracking-widest text-(--t2) mb-4 px-1">
            {t.settings.title}
          </h3>
          <div className="space-y-4">
            <div className="flex flex-col gap-2">
              <span className="text-sm font-bold text-(--t2)">Theme</span>
              <button
                onClick={toggle}
                className="flex items-center justify-between px-3 py-2 rounded-xl bg-(--bg) hover:bg-(--brd) transition border border-(--brd)"
              >
                <span className="text-xs font-black uppercase tracking-wide text-(--t1)">
                  {isDark ? "🌙 Dark" : "☀️ Light"}
                </span>
                <div className={`w-10 h-5 rounded-full transition-all relative ${isDark ? "bg-blue-600" : "bg-gray-400"}`}>
                  <div className={`absolute top-0 left-0 w-5 h-5 bg-white rounded-full shadow transition-all ${isDark ? "translate-x-5" : "translate-x-0"}`} />
                </div>
              </button>
            </div>
            <div className="flex flex-col gap-2">
              <span className="text-sm font-bold text-(--t2)">{t.settings.lang}</span>
              <div className="flex bg-(--bg) p-1 rounded-xl gap-1 border border-(--brd)">
                {(["en", "ru", "ua"] as const).map((lang) => (
                  <button
                    key={lang}
                    onClick={() => setLocale(lang)}
                    className={`flex-1 py-1.5 text-[10px] font-black rounded-lg transition-all ${
                      locale === lang
                        ? "bg-(--card) shadow-sm text-blue-600"
                        : "text-(--t2) hover:text-blue-400"
                    }`}
                  >
                    {lang.toUpperCase()}
                  </button>
                ))}
              </div>
            </div>
          </div>
        </div>

        <button
          onClick={() => setIsSettingsOpen(!isSettingsOpen)}
          className={`p-3.5 sm:p-4 rounded-2xl bg-(--card) shadow-xl border border-(--brd) transition-all duration-300 hover:scale-110 active:scale-95 ${
            isSettingsOpen ? "rotate-90 text-blue-600 border-blue-600/20" : "text-(--t2)"
          }`}
        >
          <Settings className="w-5 h-5 sm:w-6 sm:h-6" />
        </button>
      </div>

    </div>

  );
}
