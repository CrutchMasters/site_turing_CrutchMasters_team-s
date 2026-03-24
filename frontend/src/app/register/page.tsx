"use client";

import Link from "next/link";
import { useState, ChangeEvent, FormEvent, useEffect, useRef, useMemo } from "react";
import { useLanguage } from "@/context/LanguageContext";
import { createBrowserClient } from "@supabase/ssr";

const API_URL =
typeof window !== "undefined" && window.location.hostname === "localhost"
? "http://localhost:8000"
: "https://site-turing-crutchmasters-team-s.onrender.com";

const EyeIcon = () => (
  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
  </svg>
);

const EyeOffIcon = () => (
  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M13.875 18.825A10.05 10.05 0 0112 19c-4.478 0-8.268-2.943-9.543-7a9.97 9.97 0 011.563-3.029m5.858.908a3 3 0 114.243 4.243M9.878 9.878l4.242 4.242M9.88 9.88l-3.29-3.29m7.532 7.532l3.29 3.29M3 3l3.59 3.59m0 0A9.953 9.953 0 0112 5c4.478 0 8.268 2.943 9.543 7a10.025 10.025 0 01-4.132 5.411m0 0L21 21" />
  </svg>
);

export default function RegisterPage() {
  const { t } = useLanguage();

  const supabase = useMemo(() => {
    return createBrowserClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL ?? "",
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? ""
    );
  }, []);

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
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);

  const cardRef = useRef<HTMLDivElement>(null);

  const isPasswordMatch = formData.password === formData.confirmPassword;
  const passwordsNotEmpty = formData.password.length > 0;
  const canSubmit = agreed && isPasswordMatch && passwordsNotEmpty && !loading;

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

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (!canSubmit) return;

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

      const res = await fetch(`${API_URL}/api/register`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          username: formData.username,
          login: formData.login,
          email: formData.email,
          password: formData.password,
        }),
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.detail || "Failed to save user data");
      }

      window.location.href = "/main_page";

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
      <div className="fixed inset-0 flex items-center justify-center opacity-10 pointer-events-none z-0">
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
        {/* Пароль */}
        <div className="relative">
        <input
        name="password"
        type={showPassword ? "text" : "password"}
        placeholder={t.auth.password}
        value={formData.password}
        onChange={handleChange}
        className="w-full px-4 py-4 pr-9 rounded-2xl border border-gray-200 bg-white/50 focus:ring-2 focus:ring-blue-500 outline-none text-sm"
        required
        />
        <button
        type="button"
        onClick={() => setShowPassword(!showPassword)}
        className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-blue-500 transition-colors"
        >
        {showPassword ? <EyeOffIcon /> : <EyeIcon />}
        </button>
        </div>

        {/* Подтверждение пароля */}
        <div className="relative">
        <input
        name="confirmPassword"
        type={showConfirmPassword ? "text" : "password"}
        placeholder={t.auth.confirmPassword}
        value={formData.confirmPassword}
        onChange={handleChange}
        className={`w-full px-4 py-4 pr-9 rounded-2xl border bg-white/50 focus:ring-2 outline-none text-sm ${!isPasswordMatch && formData.confirmPassword ? "border-red-500" : "border-gray-200"}`}
        required
        />
        <button
        type="button"
        onClick={() => setShowConfirmPassword(!showConfirmPassword)}
        className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-blue-500 transition-colors"
        >
        {showConfirmPassword ? <EyeOffIcon /> : <EyeIcon />}
        </button>
        </div>
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
