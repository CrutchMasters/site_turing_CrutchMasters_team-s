//site_turing_CrutchMasters_team-s/frontend/src/app/register/page.tsx
"use client";

import Link from "next/link";
import { useState, useEffect, useRef, useMemo, ChangeEvent, FormEvent } from "react";
import { Settings } from "lucide-react";
import { useLanguage } from "@/context/LanguageContext";
import { useTheme } from "@/hooks/useTheme";
import { useRouter } from "next/navigation";
import { createBrowserClient } from "@supabase/ssr";
import { useAuth } from "@/context/AuthContext";

const EyeIcon = () => (
  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268-2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
  </svg>
);

const EyeOffIcon = () => (
  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M13.875 18.825A10.05 10.05 0 0112 19c-4.478 0-8.268-2.943-9.543-7a9.97 9.97 0 011.563-3.029m5.858.908a3 3 0 114.243 4.243M9.878 9.878l4.242 4.242M9.88 9.88l-3.29-3.29m7.532 7.532l3.29 3.29M3 3l3.59 3.59m0 0A9.953 9.953 0 0112 5c4.478 0 8.268-2.943 9.543 7a10.025 10.025 0 01-4.132 5.411m0 0L21 21" />
  </svg>
);

export default function RegisterPage() {
  const { t, locale, setLocale } = useLanguage();
  const { dark, toggle } = useTheme();
  const router = useRouter();
  const { login: authLogin } = useAuth();

  const supabase = useMemo(() => createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL ?? "",
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? ""
  ), []);

  const [formData, setFormData] = useState({ username: "", login: "", email: "", password: "", confirmPassword: "" });
  const [agreed, setAgreed] = useState(false);
  const [showOtp, setShowOtp] = useState(false);
  const [otp, setOtp] = useState("");
  const [loading, setLoading] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);   // ошибки формы регистрации
  const [otpError, setOtpError] = useState<string | null>(null);     // ошибки OTP
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);

  const cardRef = useRef<HTMLDivElement>(null);
  const settingsRef = useRef<HTMLDivElement>(null);
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);

  const isPasswordMatch = formData.password === formData.confirmPassword;
  const canSubmit = agreed && isPasswordMatch && formData.password.length > 0 && !loading;

  const pwStrength = (() => {
    if (!formData.password) return null;
    let s = 0;
    if (formData.password.length >= 8) s++;
    if (/[A-Z]/.test(formData.password)) s++;
    if (/[0-9]/.test(formData.password)) s++;
    if (/[^A-Za-z0-9]/.test(formData.password)) s++;
    return s;
  })();
  useEffect(() => {
    if (cardRef.current && !showOtp) {
      setTimeout(() => {
        cardRef.current?.classList.add("opacity-100", "translate-y-0");
        cardRef.current?.classList.remove("opacity-0", "-translate-y-10");
      }, 100);
    }
  }, [showOtp]);

  const handleChange = (e: ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target;
    setFormData((prev) => ({ ...prev, [name]: value }));
    setFormError(null);
  };

  // Шаг 1: проверяем уникальность → signUp → OTP
  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (!canSubmit) return;
    setLoading(true);
    setFormError(null);

    try {
      // 1. Проверяем уникальность login
      const { data: existingLogin } = await supabase
      .from("account")
      .select("id")
      .eq("login", formData.login)
      .maybeSingle();

      if (existingLogin) {
        setFormError("Цей логін вже зайнятий. Оберіть інший.");
        return;
      }

      // 2. Проверяем уникальность email
      const { data: existingEmail } = await supabase
      .from("account")
      .select("id")
      .eq("email", formData.email)
      .maybeSingle();

      if (existingEmail) {
        setFormError("Користувач з таким email вже існує.");
        return;
      }

      // 3. Регистрируем в Supabase Auth
      const { error } = await supabase.auth.signUp({
        email: formData.email,
        password: formData.password,
        options: {
          data: { username: formData.username, login: formData.login },
        },
      });

      if (error) {
        if (error.message.includes("already registered") || error.message.includes("already been registered")) {
          setFormError("Користувач з таким email вже існує.");
        } else {
          setFormError(error.message);
        }
        return;
      }

      setShowOtp(true);
    } catch (error: any) {
      setFormError(error.message || "Помилка реєстрації");
    } finally {
      setLoading(false);
    }
  };

  // Шаг 2: верифицируем OTP → бэкенд создаёт account → берём account из БД
  const handleOtpVerify = async () => {
    if (otp.length !== 6) return;
    setLoading(true);
    setOtpError(null);
    try {
      // 1. Верифицируем OTP
      const { data: verifyData, error: verifyError } = await supabase.auth.verifyOtp({
        email: formData.email,
        token: otp,
        type: "signup",
      });

      if (verifyError) throw verifyError;
      if (!verifyData.session) throw new Error("Сесія не отримана після верифікації");

      const accessToken = verifyData.session.access_token;
      const refreshToken = verifyData.session.refresh_token;

      // 2. account уже создан автоматически триггером handle_new_user при signUp.
      // Бэкенд не нужен. Просто читаем запись из БД.
      // Ретраим до 5 раз — триггер срабатывает асинхронно и может чуть задержаться.
      // 3. Берём account из БД
      let accountData: any = null;
      for (let attempt = 0; attempt < 5; attempt++) {
        if (attempt > 0) await new Promise(r => setTimeout(r, 600));
        const { data } = await supabase
          .from("account")
          .select("id, username, login, email, role, status, avatar_url")
          .eq("email", formData.email)
          .maybeSingle();
        if (data) { accountData = data; break; }
      }

      if (!accountData) {
        throw new Error("Не вдалося отримати дані акаунту після реєстрації");
      }

      // 4. Сохраняем в контекст и localStorage
      const userData = {
        id:         accountData.id,
        email:      accountData.email,
        username:   accountData.username,
        login:      accountData.login,
        role:       accountData.role as "user" | "admin" | "jury" | "superadmin",
        status:     accountData.status,
        avatar_url: accountData.avatar_url,
      };

      authLogin(userData, accessToken, refreshToken);
      // Небольшая пауза чтобы стейт успел обновиться перед навигацией
      await new Promise(r => setTimeout(r, 100));
      router.push("/dashboard");

    } catch (error: any) {
      setOtpError(error.message || "Verification failed");
    } finally {
      setLoading(false);
    }
  };

  const inputClass = "w-full px-5 py-4 rounded-2xl border border-(--brd) bg-(--bg)/50 focus:ring-2 focus:ring-blue-500 focus:bg-(--card) outline-none text-sm text-(--t1) transition-all";

  const isDark = dark;
  return (
    <div className="min-h-screen bg-(--bg) flex flex-col items-center justify-center font-sans text-(--t1) relative overflow-hidden transition-colors duration-300 px-4">
    <style jsx global>{`
      .reveal-drop { transition: all 0.8s cubic-bezier(0.22, 1, 0.36, 1); }
      .otp-animate { animation: slideUp 0.6s cubic-bezier(0.22, 1, 0.36, 1) forwards; }
      @keyframes slideUp {
        from { opacity: 0; transform: translateY(20px) scale(0.95); }
        to   { opacity: 1; transform: translateY(0) scale(1); }
      }
      `}</style>

      {/* Watermark */}
      <div className={`fixed inset-0 flex items-center justify-center pointer-events-none z-0 transition-opacity ${dark ? "opacity-10" : "opacity-5"}`}>
      <img src="/logo_background1.png" alt="" className={`w-[min(800px,90vw)] h-[min(800px,90vw)] object-contain blur-sm ${dark ? "invert" : ""}`} />
      </div>

      {!showOtp && (
        <Link href="/" className="absolute top-6 left-6 sm:top-8 sm:left-8 text-(--t2) hover:text-blue-600 text-xs font-black uppercase tracking-[0.3em] transition-all flex items-center gap-2 z-20">
        <span>←</span> {t.nav.backHome}
        </Link>
      )}

      {!showOtp ? (
        <div ref={cardRef} className="reveal-drop opacity-0 -translate-y-10 z-10 w-full max-w-md bg-(--card)/70 backdrop-blur-2xl p-8 sm:p-10 rounded-[2rem] sm:rounded-[2.5rem] shadow-2xl border border-(--brd) flex flex-col items-center">
        <h1 className="text-3xl sm:text-4xl font-black text-(--t1) mb-8 tracking-tighter uppercase text-center">
        {t.auth.registerTitle}
        </h1>

        <form onSubmit={handleSubmit} className="w-full flex flex-col gap-4">
        <input name="username" type="text" placeholder={t.auth.username} value={formData.username} onChange={handleChange} className={inputClass} required />
        <input name="login"    type="text" placeholder={t.auth.login}    value={formData.login}    onChange={handleChange} className={inputClass} required />
        <input name="email"    type="email" placeholder={t.auth.email}   value={formData.email}    onChange={handleChange} className={inputClass} required />

        <div className="flex flex-col gap-3">
        <div className="flex flex-col gap-1.5">
        <div className="relative">
        <input name="password" type={showPassword ? "text" : "password"} placeholder={t.auth.password} value={formData.password} onChange={handleChange}
        className="w-full px-4 py-4 pr-10 rounded-2xl border border-(--brd) bg-(--bg)/50 focus:ring-2 focus:ring-blue-500 focus:bg-(--card) outline-none text-sm text-(--t1)" required />
        <button type="button" onClick={() => setShowPassword(!showPassword)} className="absolute right-3 top-1/2 -translate-y-1/2 text-(--t2) hover:text-blue-500 transition-colors">
        {showPassword ? <EyeOffIcon /> : <EyeIcon />}
        </button>
        </div>
        {pwStrength !== null && (
          <div className="space-y-1 px-1">
          <div className="flex gap-1">
          {[1, 2, 3, 4].map(i => (
            <div key={i} className={`h-1 flex-1 rounded-full transition-all duration-300 ${
              i <= pwStrength
              ? pwStrength <= 1 ? "bg-red-500" : pwStrength === 2 ? "bg-amber-500" : pwStrength === 3 ? "bg-blue-500" : "bg-green-500"
              : "bg-(--brd)"
            }`} />
          ))}
          </div>
          <p className="text-[10px] font-bold text-(--t2)">
          {pwStrength <= 1 ? "Слабкий" : pwStrength === 2 ? "Середній" : pwStrength === 3 ? "Хороший" : "Надійний"}
          </p>
          </div>
        )}
        </div>
        <div className="relative">
        <input name="confirmPassword" type={showConfirmPassword ? "text" : "password"} placeholder={t.auth.confirmPassword} value={formData.confirmPassword} onChange={handleChange}
        className={`w-full px-4 py-4 pr-10 rounded-2xl border bg-(--bg)/50 focus:ring-2 focus:bg-(--card) outline-none text-sm text-(--t1) ${!isPasswordMatch && formData.confirmPassword ? "border-red-500" : "border-(--brd)"}`} required />
        <button type="button" onClick={() => setShowConfirmPassword(!showConfirmPassword)} className="absolute right-3 top-1/2 -translate-y-1/2 text-(--t2) hover:text-blue-500 transition-colors">
        {showConfirmPassword ? <EyeOffIcon /> : <EyeIcon />}
        </button>
        </div>
        </div>

        <div className="flex items-center gap-3 py-1">
        <input type="checkbox" id="privacy" checked={agreed} onChange={() => setAgreed(!agreed)} className="w-5 h-5 cursor-pointer accent-blue-600 rounded-lg flex-shrink-0" />
        <label htmlFor="privacy" className="text-[11px] font-bold text-(--t2) cursor-pointer uppercase tracking-wider">
        {t.auth.privacy}{" "}
        <Link href="/privacy_policy" target="_blank" onClick={(e) => e.stopPropagation()}
        className="text-blue-600 hover:text-blue-500 hover:underline underline-offset-2 transition-colors">
        Privacy Policy
        </Link>
        </label>
        </div>

        {/* Ошибка формы */}
        {formError && (
          <div className="px-4 py-3 rounded-2xl bg-red-500/10 border border-red-500/20 text-red-500 text-[11px] font-bold text-center">
          {formError}
          </div>
        )}

        <button type="submit" disabled={!canSubmit}
        className={`w-full py-5 rounded-[2rem] text-xl font-black shadow-xl transition-all active:scale-95 uppercase tracking-tighter ${
          canSubmit ? "bg-blue-600 text-white hover:bg-blue-700 shadow-blue-500/20" : "bg-(--brd) text-(--t2) cursor-not-allowed"
        }`}>
        {loading ? "..." : t.auth.registerBtn}
        </button>
        </form>

        <div className="mt-6 text-center">
        <span className="text-(--t2) text-xs font-bold uppercase tracking-widest">{t.auth.haveAccount} </span>
        <Link href="/login" className="text-blue-600 font-black hover:underline ml-1 uppercase text-xs tracking-widest">
        {t.auth.toSignIn}
        </Link>
        </div>
        </div>
      ) : (
        <div className="otp-animate z-20 w-full max-w-sm bg-(--card)/80 backdrop-blur-3xl p-10 rounded-[3rem] shadow-2xl border border-(--brd) flex flex-col items-center text-(--t1)">
        <div className="w-16 h-16 bg-blue-600/10 rounded-2xl flex items-center justify-center text-blue-600 mb-6">
        <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
        </svg>
        </div>
        <h2 className="text-2xl font-black text-(--t1) uppercase mb-2">Verify</h2>
        <p className="text-center text-(--t2) text-[10px] font-bold uppercase mb-8">
        Enter 6-digit code sent to {formData.email}
        </p>

        <input
        type="text" maxLength={6} value={otp}
        onChange={(e) => { setOtp(e.target.value.replace(/\D/g, "")); setOtpError(null); }}
        placeholder="000000"
        className="w-full text-center text-4xl font-black tracking-[0.2em] py-5 rounded-2xl bg-(--bg)/50 focus:bg-(--card) focus:ring-2 focus:ring-blue-500 outline-none transition-all text-blue-600 mb-4 placeholder:text-(--t2)/30"
        />

        {otpError && (
          <div className="w-full mb-4 px-4 py-3 rounded-2xl bg-red-500/10 border border-red-500/20 text-red-500 text-[11px] font-bold text-center">
          {otpError}
          </div>
        )}

        <button onClick={handleOtpVerify} disabled={otp.length !== 6 || loading}
        className={`w-full py-5 rounded-[1.8rem] font-black uppercase shadow-lg transition-all mb-4 ${
          otp.length === 6 && !loading ? "bg-blue-600 text-white shadow-blue-500/20" : "bg-(--brd) text-(--t2) cursor-not-allowed"
        }`}>
        {loading ? "..." : "Confirm"}
        </button>

        <button onClick={() => { setShowOtp(false); setOtp(""); setOtpError(null); }}
        className="text-[10px] font-black text-(--t2) hover:text-red-500 uppercase tracking-[0.3em] transition-all flex items-center gap-2">
        <span>←</span> Back
        </button>
        </div>
      )}

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
                {(["en", "ua"] as const).map((lang) => (
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