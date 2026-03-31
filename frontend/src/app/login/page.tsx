"use client";

import Link from "next/link";
import { useEffect, useRef, useState, FormEvent } from "react";
import { useLanguage } from "@/context/LanguageContext";
import { useTheme } from "@/hooks/useTheme";
import { useRouter } from "next/navigation";
import { createBrowserClient } from "@supabase/ssr";

const API_URL =
typeof window !== "undefined" && window.location.hostname === "localhost"
? "http://localhost:8000"
: "https://site-turing-crutchmasters-team-s.onrender.com";

export default function LoginPage() {
  const { t } = useLanguage();
  const { dark } = useTheme();
  const router = useRouter();
  const cardRef = useRef<HTMLDivElement>(null);

  const [login, setLogin] = useState("");
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
      const supabase = createBrowserClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL ?? "",
        process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? ""
      );

      let email = login.trim();

      // Якщо введено логін а не email — знаходимо email через FastAPI
      if (!email.includes("@")) {
        const res = await fetch(`${API_URL}/api/get-email?login=${email}`);
        const data = await res.json();
        if (!res.ok) { setError("User not found"); setLoading(false); return; }
        email = data.email;
      }

      const { data, error: authError } = await supabase.auth.signInWithPassword({ email, password });
      if (authError) { setError("Invalid login or password"); setLoading(false); return; }

      if (data.session) {
        const token = data.session.access_token;

        // Зберігаємо токен
        localStorage.setItem("access_token", token);
        // Cookie для middleware
        document.cookie = `access_token=${token}; path=/; max-age=604800`;

        // Спочатку пробуємо отримати профіль з FastAPI
        let userData = null;
        try {
          const userRes = await fetch(`${API_URL}/api/user-profile`, {
            headers: { Authorization: `Bearer ${token}` }
          });
          if (userRes.ok) {
            userData = await userRes.json();
          }
        } catch {}

        // Якщо FastAPI не відповів — будуємо профіль з даних Supabase
        if (!userData) {
          const supabaseUser = data.session.user;
          userData = {
            id: supabaseUser.id,
            email: supabaseUser.email ?? "",
            username: supabaseUser.user_metadata?.username ?? supabaseUser.email?.split("@")[0] ?? "User",
            login: supabaseUser.user_metadata?.login ?? supabaseUser.email?.split("@")[0] ?? "user",
            role: "user",
          };
        }

        localStorage.setItem("user", JSON.stringify(userData));
      }

      router.push("/main_page");
    } catch {
      setError("Server connection error");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-(--bg) flex flex-col items-center justify-center font-sans text-(--t1) relative overflow-hidden transition-colors duration-300">
    <style jsx global>{`.reveal-drop { transition: all 0.8s cubic-bezier(0.22, 1, 0.36, 1); }`}</style>

    {/* Watermark */}
    <div className={`fixed inset-0 flex items-center justify-center pointer-events-none z-0 transition-opacity ${dark ? "opacity-10" : "opacity-5"}`}>
    <img src="/logo_background1.png" alt="" className={`w-[min(800px,90vw)] h-[min(800px,90vw)] object-contain blur-sm ${dark ? "invert" : ""}`} />
    </div>

    <Link href="/" className="absolute top-6 left-6 sm:top-8 sm:left-8 text-(--t2) hover:text-blue-600 text-xs font-black uppercase tracking-[0.3em] transition-all flex items-center gap-2 group z-20">
    <span className="group-hover:-translate-x-1 transition-transform">←</span> {t.nav.backHome}
    </Link>

    <div ref={cardRef} className="reveal-drop opacity-0 -translate-y-10 z-10 w-full max-w-sm mx-4 bg-(--card)/70 backdrop-blur-2xl p-8 sm:p-10 rounded-[2rem] sm:rounded-[2.5rem] shadow-2xl border border-(--brd) flex flex-col items-center">
    <h1 className="text-3xl sm:text-4xl font-black text-(--t1) mb-8 tracking-tighter uppercase text-center">
    {t.auth.loginTitle}
    </h1>

    <form onSubmit={handleSubmit} className="w-full flex flex-col gap-4">
    <input
    type="text"
    placeholder={t.auth.login}
    value={login}
    onChange={(e) => setLogin(e.target.value)}
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
    <button type="button" onClick={() => setShowPassword(!showPassword)} className="absolute right-4 top-1/2 -translate-y-1/2 text-(--t2) hover:text-blue-500 transition-colors">
    {showPassword ? (
      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M13.875 18.825A10.05 10.05 0 0112 19c-4.478 0-8.268-2.943-9.543-7a9.97 9.97 0 011.563-3.029m5.858.908a3 3 0 114.243 4.243M9.878 9.878l4.242 4.242M9.88 9.88l-3.29-3.29m7.532 7.532l3.29 3.29M3 3l3.59 3.59m0 0A9.953 9.953 0 0112 5c4.478 0 8.268 2.943 9.543 7a10.025 10.025 0 01-4.132 5.411m0 0L21 21" /></svg>
    ) : (
      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" /><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" /></svg>
    )}
    </button>
    </div>

    {error && <p className="text-red-500 text-xs font-bold uppercase tracking-wide text-center">{error}</p>}

    <button
    type="submit"
    disabled={loading || !login || !password}
    className={`w-full mt-2 py-5 rounded-[2rem] text-lg sm:text-xl font-black shadow-xl transition-all active:scale-95 uppercase tracking-tighter ${
      loading || !login || !password
      ? "bg-(--brd) text-(--t2) cursor-not-allowed"
      : "bg-blue-600 text-white hover:bg-blue-700 shadow-blue-500/20"
    }`}
    >
    {loading ? "..." : t.auth.loginBtn}
    </button>
    </form>

    <div className="mt-8 text-center">
    <span className="text-(--t2) text-xs font-bold uppercase tracking-widest">{t.auth.noAccount} </span>
    <Link href="/register" className="text-blue-600 font-black hover:underline ml-1 uppercase text-xs tracking-widest">
    {t.auth.toSignUp}
    </Link>
    </div>
    </div>
    </div>
  );
}
