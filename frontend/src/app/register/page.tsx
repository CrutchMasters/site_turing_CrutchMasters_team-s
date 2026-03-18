"use client";

import Link from "next/link";
import { useState, ChangeEvent, FormEvent, useEffect, useRef, useMemo } from "react";
import { useLanguage } from "@/context/LanguageContext";
import { createBrowserClient } from "@supabase/ssr";

export default function RegisterPage() {
  const { t } = useLanguage();

  // 1. Инициализируем клиент через useMemo, чтобы он создавался один раз
  // и не падал при отсутствии переменных в момент сборки
  const supabase = useMemo(() => {
    return createBrowserClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL ?? "",
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? ""
    );
  }, []);

  // Состояния для полей формы
  const [formData, setFormData] = useState({
    username: "",
    login: "",
    email: "",
    password: "",
    confirmPassword: ""
  });

  const [agreed, setAgreed] = useState(false);
  const [showOtp, setShowOtp] = useState(false);
  const [otp, setOtp] = useState("");
  const [loading, setLoading] = useState(false);

  const cardRef = useRef<HTMLDivElement>(null);

  // Валидация
  const isPasswordMatch = formData.password === formData.confirmPassword;
  const passwordsNotEmpty = formData.password.length > 0;
  const canSubmit = agreed && isPasswordMatch && passwordsNotEmpty && !loading;

  // Анимация появления
  useEffect(() => {
    if (cardRef.current && !showOtp) {
      const timer = setTimeout(() => {
        cardRef.current?.classList.add("opacity-100", "translate-y-0");
        cardRef.current?.classList.remove("opacity-0", "-translate-y-10");
      }, 100);
      return () => clearTimeout(timer);
    }
  }, [showOtp]);

  const handleChange = (e: ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target;
    setFormData((prev) => ({ ...prev, [name]: value }));
  };

  // 1. Отправка данных на регистрацию
  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (!canSubmit) return;

    // Защитная проверка переменных перед запросом
    if (!process.env.NEXT_PUBLIC_SUPABASE_URL || !process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY) {
      alert("System Error: Supabase keys are missing.");
      return;
    }

    setLoading(true);
    try {
      const { error } = await supabase.auth.signUp({
        email: formData.email,
        password: formData.password,
        options: {
          data: {
            username: formData.username,
            login: formData.login,
          },
        },
      });

      if (error) throw error;
      setShowOtp(true);
    } catch (error: any) {
      alert(error.message || "Registration failed");
    } finally {
      setLoading(false);
    }
  };

  // 2. Проверка OTP кода
  const handleOtpVerify = async () => {
    if (otp.length !== 6) return;

    setLoading(true);
    try {
      const { error } = await supabase.auth.verifyOtp({
        email: formData.email,
        token: otp,
        type: 'signup',
      });

      if (error) throw error;

      alert("Success!");
      window.location.href = "/dashboard";
    } catch (error: any) {
      alert(error.message || "Verification failed");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#f3f4f6] flex flex-col items-center justify-center font-sans text-slate-900 relative overflow-hidden">
    <style jsx global>{`
      .reveal-drop { transition: all 0.8s cubic-bezier(0.22, 1, 0.36, 1); }
      .otp-animate { animation: slideUp 0.6s cubic-bezier(0.22, 1, 0.36, 1) forwards; }
      @keyframes slideUp {
        from { opacity: 0; transform: translateY(20px) scale(0.95); }
        to { opacity: 1; transform: translateY(0) scale(1); }
      }
      `}</style>

      {/* Watermark */}
      <div className="absolute inset-0 flex items-center justify-center opacity-10 pointer-events-none">
      <img src="/logo_backround1.svg" alt="Watermark" className="w-[800px] h-[800px] object-contain" />
      </div>

      {!showOtp && (
        <Link href="/" className="absolute top-8 left-8 text-gray-400 hover:text-blue-600 text-xs font-black uppercase tracking-[0.3em] transition-all flex items-center gap-2 z-20">
        <span>←</span> {t.nav.backHome}
        </Link>
      )}

      {!showOtp ? (
        <div ref={cardRef} className="reveal-drop opacity-0 -translate-y-10 z-10 w-full max-w-md bg-white/70 backdrop-blur-2xl p-10 rounded-[2.5rem] shadow-2xl border border-white/50 flex flex-col items-center">
        <h1 className="text-4xl font-black text-gray-800 mb-8 tracking-tighter uppercase text-center">
        {t.auth.registerTitle}
        </h1>

        <form onSubmit={handleSubmit} className="w-full flex flex-col gap-4">
        <input name="username" type="text" placeholder={t.auth.username} value={formData.username} onChange={handleChange} className="w-full px-5 py-4 rounded-2xl border border-gray-200 bg-white/50 focus:ring-2 focus:ring-blue-500 outline-none text-sm" required />
        <input name="login" type="text" placeholder={t.auth.login} value={formData.login} onChange={handleChange} className="w-full px-5 py-4 rounded-2xl border border-gray-200 bg-white/50 focus:ring-2 focus:ring-blue-500 outline-none text-sm" required />
        <input name="email" type="email" placeholder={t.auth.email} value={formData.email} onChange={handleChange} className="w-full px-5 py-4 rounded-2xl border border-gray-200 bg-white/50 focus:ring-2 focus:ring-blue-500 outline-none text-sm" required />

        <div className="grid grid-cols-2 gap-3">
        <input name="password" type="password" placeholder={t.auth.password} value={formData.password} onChange={handleChange} className="w-full px-4 py-4 rounded-2xl border border-gray-200 bg-white/50 focus:ring-2 focus:ring-blue-500 outline-none text-sm" required />
        <input name="confirmPassword" type="password" placeholder={t.auth.confirmPassword} value={formData.confirmPassword} onChange={handleChange} className={`w-full px-4 py-4 rounded-2xl border bg-white/50 focus:ring-2 outline-none text-sm ${!isPasswordMatch && formData.confirmPassword ? "border-red-500" : "border-gray-200"}`} required />
        </div>

        <div className="flex items-center gap-3 py-2">
        <input type="checkbox" id="privacy" checked={agreed} onChange={() => setAgreed(!agreed)} className="w-5 h-5 cursor-pointer accent-blue-600 rounded-lg" />
        <label htmlFor="privacy" className="text-[11px] font-bold text-gray-500 cursor-pointer uppercase tracking-wider">
        {t.auth.privacy}
        </label>
        </div>

        <button type="submit" disabled={!canSubmit} className={`w-full py-5 rounded-[2rem] text-xl font-black shadow-xl transition-all active:scale-95 uppercase tracking-tighter ${canSubmit ? "bg-blue-600 text-white hover:bg-blue-700 shadow-blue-200" : "bg-gray-200 text-gray-400 cursor-not-allowed"}`}>
        {loading ? "..." : t.auth.registerBtn}
        </button>
        </form>
        </div>
      ) : (
        <div className="otp-animate z-20 w-full max-w-sm bg-white/80 backdrop-blur-3xl p-10 rounded-[3rem] shadow-2xl border border-white/50 flex flex-col items-center">
        <div className="w-16 h-16 bg-blue-50 rounded-2xl flex items-center justify-center text-blue-600 mb-6">
        <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z"/>
        </svg>
        </div>
        <h2 className="text-2xl font-black text-gray-800 uppercase mb-2">Verify</h2>
        <p className="text-center text-gray-400 text-[10px] font-bold uppercase mb-8">
        Enter 6-digit code sent to {formData.email}
        </p>
        <input type="text" maxLength={6} value={otp} onChange={(e) => setOtp(e.target.value.replace(/\D/g, ""))} placeholder="000000" className="w-full text-center text-4xl font-black tracking-[0.2em] py-5 rounded-2xl bg-gray-100/50 focus:bg-white focus:ring-2 focus:ring-blue-500 outline-none transition-all text-blue-600 mb-8" />
        <button onClick={handleOtpVerify} disabled={otp.length !== 6 || loading} className={`w-full py-5 rounded-[1.8rem] font-black uppercase shadow-lg transition-all mb-4 ${otp.length === 6 ? "bg-blue-600 text-white" : "bg-gray-200 text-gray-400"}`}>
        {loading ? "..." : "Confirm"}
        </button>
        <button onClick={() => { setShowOtp(false); setOtp(""); }} className="group text-[10px] font-black text-gray-400 hover:text-red-500 uppercase tracking-[0.3em] transition-all flex items-center gap-2">
        <span>←</span> Back
        </button>
        </div>
      )}
      </div>
  );
}
