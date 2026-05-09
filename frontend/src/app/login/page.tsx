//site_turing_CrutchMasters_team-s/frontend/src/app/login/page.tsx
"use client";

import Link from "next/link";
import { useEffect, useRef, useState, FormEvent } from "react";
import { createPortal } from "react-dom";
import { Settings, KeyRound, Mail, Lock, Eye, EyeOff, Loader, CheckCircle, RefreshCw, X, AlertCircle } from "lucide-react";
import { useLanguage } from "@/context/LanguageContext";
import { useTheme } from "@/hooks/useTheme";
import { useRouter } from "next/navigation";
import { useAuth } from "@/context/AuthContext";
import { createClient } from "@supabase/supabase-js";

const API_URL =
  typeof window !== "undefined" && window.location.hostname === "localhost"
    ? "http://localhost:8000"
    : "https://site-turing-crutchmasters-team-s.onrender.com";

// Инициализация Supabase клиента
// Замените на ваши реальные значения из https://supabase.com/dashboard/project/YOUR_PROJECT/settings/api
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
const supabase = createClient(supabaseUrl, supabaseAnonKey);

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

  // --- Сброс пароля (multi-step: idle → sending → code → verifying → newpw → done) ---
  type PwStep = "idle" | "sending" | "code" | "verifying" | "newpw" | "done";
  const [showResetModal, setShowResetModal] = useState(false);
  const [pwStep, setPwStep]               = useState<PwStep>("idle");
  const [resetEmail, setResetEmail]       = useState("");
  const [resetCode, setResetCode]         = useState("");
  const [newPw, setNewPw]                 = useState("");
  const [confirmPw, setConfirmPw]         = useState("");
  const [showNewPw, setShowNewPw]         = useState(false);
  const [showConfirmPw, setShowConfirmPw] = useState(false);
  const [pwError, setPwError]             = useState<string | null>(null);
  const [resendCooldown, setResendCooldown] = useState(0);

  useEffect(() => {
    if (resendCooldown <= 0) return;
    const timer = setInterval(() => setResendCooldown(p => Math.max(0, p - 1)), 1000);
    return () => clearInterval(timer);
  }, [resendCooldown]);

  const pwStrength = (() => {
    if (!newPw) return null; let s = 0;
    if (newPw.length >= 8) s++; if (/[A-Z]/.test(newPw)) s++;
    if (/[0-9]/.test(newPw)) s++; if (/[^A-Za-z0-9]/.test(newPw)) s++;
    return s;
  })();

  function closeReset() {
    setShowResetModal(false); setPwStep("idle"); setResetEmail("");
    setResetCode(""); setNewPw(""); setConfirmPw(""); setPwError(null);
  }

  async function sendResetCode() {
    if (!resetEmail) return;
    setPwError(null); setPwStep("sending");
    try {
      const { error } = await supabase.auth.resetPasswordForEmail(resetEmail, { redirectTo: undefined });
      if (error) throw error;
      setPwStep("code"); setResendCooldown(60);
    } catch (e: any) { setPwError(e?.message ?? "Send error"); setPwStep("idle"); }
  }

  async function verifyResetCode() {
    if (!/^\d{6}$/.test(resetCode)) return setPwError(t.auth.twoFaCodeRequired);
    setPwError(null); setPwStep("verifying");
    try {
      const { error } = await supabase.auth.verifyOtp({ email: resetEmail, token: resetCode, type: "recovery" });
      if (error) throw error;
      setPwStep("newpw");
    } catch { setPwError("Invalid or expired code."); setPwStep("code"); }
  }

  async function applyNewPassword() {
    if (newPw.length < 8) return setPwError("Minimum 8 characters");
    if (newPw !== confirmPw) return setPwError("Passwords do not match");
    setPwError(null); setPwStep("verifying");
    try {
      const { error } = await supabase.auth.updateUser({ password: newPw });
      if (error) throw error;
      setPwStep("done");
    } catch (e: any) { setPwError(e?.message ?? "Error"); setPwStep("newpw"); }
  }

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
        return;
      }

      authLogin(data.user, data.access_token, data.refresh_token);
      router.push("/dashboard");
    } catch (err) {
      console.error("Login error:", err);
      setError("Server connection error");
    } finally {
      setLoading(false);
    }
  };

  const isDark = dark;
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
            placeholder={t.auth.loginPlaceholder}
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
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth="2"
                    d="M13.875 18.825A10.05 10.05 0 0112 19c-4.478 0-8.268-2.943-9.543-7a9.97 9.97 0 011.563-3.029m5.858.908a3 3 0 114.243 4.243M9.878 9.878l4.242 4.242M9.88 9.88l-3.29-3.29m7.532 7.532l3.29 3.29M3 12a9 9 0 1118 0m0 0a9 9 0 01-18 0m0 0a9 9 0 0118 0"
                  />
                </svg>
              ) : (
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
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

          <div className="flex justify-end -mt-1">
            <button
              type="button"
              onClick={() => { setShowResetModal(true); setPwStep("idle"); setResetEmail(""); setPwError(null); }}
              className="text-xs font-bold text-(--t2) hover:text-blue-500 transition-colors uppercase tracking-widest"
            >
              {t.auth.forgotPassword}
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

      {/* ===== МОДАЛЬНОЕ ОКНО 2FA ===== */}
      {/* ===== МОДАЛЬНОЕ ОКНО СБРОСА ПАРОЛЯ (multi-step) ===== */}
      {showResetModal && typeof document !== "undefined" && createPortal(
        <>
          <style>{`
            @keyframes pwSlideUp { from { opacity:0; transform:translateY(20px) scale(0.95); } to { opacity:1; transform:translateY(0) scale(1); } }
            .pw-modal-card { animation: pwSlideUp 0.5s cubic-bezier(0.22,1,0.36,1) forwards; }
          `}</style>

          {/* Overlay */}
          <div
            className="fixed inset-0 z-[9998]"
            style={{ backdropFilter: "blur(8px)", WebkitBackdropFilter: "blur(8px)", background: "rgba(0,0,0,0.6)" }}
            onClick={closeReset}
          />

          {/* Modal */}
          <div className="fixed inset-0 z-[9999] flex items-center justify-center p-4 pointer-events-none">
          <div className="pw-modal-card pointer-events-auto w-full max-w-sm bg-(--card)/80 backdrop-blur-3xl rounded-[2.5rem] shadow-2xl border border-(--brd) flex flex-col items-center text-(--t1) overflow-hidden">

            {/* Header */}
            <div className="w-full flex items-center justify-between px-7 py-4 border-b border-(--brd)">
              <div className="flex items-center gap-2.5">
                <KeyRound size={14} className="text-blue-500" />
                <span className="text-xs font-black uppercase tracking-widest text-(--t1)">{t.auth.resetTitle}</span>
              </div>
              <button onClick={closeReset} className="w-7 h-7 rounded-xl border border-(--brd) bg-(--bg) flex items-center justify-center text-(--t2) hover:text-red-500 hover:border-red-500/40 transition-all active:scale-95">
                <X size={13} />
              </button>
            </div>

            <div className="w-full flex flex-col items-center p-10">

              {/* Step: idle — enter email */}
              {pwStep === "idle" && (
                <>
                  <div className="w-16 h-16 bg-blue-600/10 rounded-2xl flex items-center justify-center text-blue-600 mb-6">
                    <KeyRound size={28} />
                  </div>
                  <h2 className="text-2xl font-black text-(--t1) uppercase mb-2 tracking-tight">{t.auth.resetTitle}</h2>
                  <p className="text-center text-(--t2) text-[10px] font-bold uppercase mb-8 leading-relaxed">{t.auth.resetHint}</p>
                  <input
                    type="email"
                    placeholder="your@email.com"
                    value={resetEmail}
                    onChange={e => { setResetEmail(e.target.value); setPwError(null); }}
                    className="w-full px-5 py-4 rounded-2xl border border-(--brd) bg-(--bg)/50 text-(--t1) focus:ring-2 focus:ring-blue-500 focus:bg-(--card) outline-none transition-all placeholder:italic text-sm mb-4"
                  />
                  {pwError && (
                    <div className="w-full mb-4 px-4 py-3 rounded-2xl bg-red-500/10 border border-red-500/20 text-red-500 text-[11px] font-bold text-center flex items-center gap-2">
                      <AlertCircle size={13} className="flex-shrink-0" />{pwError}
                    </div>
                  )}
                  <button
                    onClick={sendResetCode}
                    disabled={!resetEmail}
                    className={`w-full py-5 rounded-[1.8rem] font-black uppercase shadow-lg transition-all active:scale-95 text-sm tracking-wider ${
                      resetEmail ? "bg-blue-600 text-white hover:bg-blue-700 shadow-blue-500/20" : "bg-(--brd) text-(--t2) cursor-not-allowed"
                    }`}
                  >
                    {t.auth.resetSend}
                  </button>
                </>
              )}

              {/* Step: sending */}
              {pwStep === "sending" && (
                <div className="flex flex-col items-center gap-4 py-4">
                  <div className="w-16 h-16 bg-blue-600/10 rounded-2xl flex items-center justify-center text-blue-600">
                    <Loader size={32} className="animate-spin" />
                  </div>
                  <p className="text-xs font-black uppercase tracking-widest text-(--t2)">Sending code...</p>
                </div>
              )}

              {/* Step: code — enter OTP */}
              {pwStep === "code" && (
                <>
                  <div className="w-16 h-16 bg-blue-600/10 rounded-2xl flex items-center justify-center text-blue-600 mb-6">
                    <Mail size={32} />
                  </div>
                  <h2 className="text-2xl font-black text-(--t1) uppercase mb-2 tracking-tight">Verify</h2>
                  <p className="text-center text-(--t2) text-[10px] font-bold uppercase mb-8 leading-relaxed">
                    Enter the 6-digit code sent to<br />
                    <span className="text-(--t1) font-black">{resetEmail}</span>
                  </p>
                  <input
                    type="text"
                    maxLength={6}
                    value={resetCode}
                    onChange={e => { setResetCode(e.target.value.replace(/\D/g, "")); setPwError(null); }}
                    placeholder="000000"
                    className="w-full text-center text-4xl font-black tracking-[0.2em] py-5 rounded-2xl bg-(--bg)/50 focus:bg-(--card) focus:ring-2 focus:ring-blue-500 outline-none transition-all text-blue-600 mb-4 placeholder:text-(--t2)/30 border border-(--brd)"
                  />
                  {pwError && (
                    <div className="w-full mb-4 px-4 py-3 rounded-2xl bg-red-500/10 border border-red-500/20 text-red-500 text-[11px] font-bold text-center">{pwError}</div>
                  )}
                  <button
                    onClick={verifyResetCode}
                    disabled={resetCode.length !== 6}
                    className={`w-full py-5 rounded-[1.8rem] font-black uppercase shadow-lg transition-all active:scale-95 mb-4 text-sm tracking-wider ${
                      resetCode.length === 6 ? "bg-blue-600 text-white hover:bg-blue-700 shadow-blue-500/20" : "bg-(--brd) text-(--t2) cursor-not-allowed"
                    }`}
                  >
                    Confirm
                  </button>
                  <div className="flex items-center justify-between w-full">
                    <button
                      onClick={() => { if (resendCooldown === 0) sendResetCode(); }}
                      disabled={resendCooldown > 0}
                      className="flex items-center gap-1.5 text-[10px] font-black uppercase tracking-[0.2em] text-(--t2) hover:text-blue-600 transition-colors disabled:opacity-40"
                    >
                      <RefreshCw size={10} />
                      {resendCooldown > 0 ? `Resend in ${resendCooldown}s` : t.auth.twoFaResend}
                    </button>
                    <button onClick={closeReset} className="text-[10px] font-black text-(--t2) hover:text-red-500 uppercase tracking-[0.2em] transition-all flex items-center gap-1.5">
                      <span>←</span> {t.auth.resetCancel}
                    </button>
                  </div>
                </>
              )}

              {/* Step: verifying */}
              {pwStep === "verifying" && (
                <div className="flex flex-col items-center gap-4 py-4">
                  <div className="w-16 h-16 bg-blue-600/10 rounded-2xl flex items-center justify-center text-blue-600">
                    <Loader size={32} className="animate-spin" />
                  </div>
                  <p className="text-xs font-black uppercase tracking-widest text-(--t2)">Verifying...</p>
                </div>
              )}

              {/* Step: newpw — set new password */}
              {pwStep === "newpw" && (
                <>
                  <div className="w-16 h-16 bg-green-500/10 rounded-2xl flex items-center justify-center text-green-500 mb-6">
                    <Lock size={28} />
                  </div>
                  <h2 className="text-2xl font-black text-(--t1) uppercase mb-2 tracking-tight">New Password</h2>
                  <p className="text-center text-(--t2) text-[10px] font-bold uppercase mb-6">Set a new password for your account</p>
                  <div className="w-full space-y-3">
                    <div className="relative">
                      <input
                        type={showNewPw ? "text" : "password"}
                        value={newPw}
                        onChange={e => setNewPw(e.target.value)}
                        placeholder="Minimum 8 characters..."
                        className="w-full px-5 py-4 pr-12 rounded-2xl border border-(--brd) bg-(--bg)/50 focus:ring-2 focus:ring-blue-500 focus:bg-(--card) outline-none text-sm text-(--t1) transition-all"
                      />
                      <button type="button" onClick={() => setShowNewPw(p => !p)} className="absolute right-4 top-1/2 -translate-y-1/2 text-(--t2) hover:text-blue-600 transition-colors">
                        {showNewPw ? <EyeOff size={16} /> : <Eye size={16} />}
                      </button>
                    </div>
                    {newPw && pwStrength !== null && (
                      <div className="space-y-1 px-1">
                        <div className="flex gap-1">
                          {[1,2,3,4].map(i => (
                            <div key={i} className={`h-1 flex-1 rounded-full transition-all duration-300 ${
                              i <= pwStrength
                                ? pwStrength <= 1 ? "bg-red-500" : pwStrength === 2 ? "bg-amber-500" : pwStrength === 3 ? "bg-blue-500" : "bg-green-500"
                                : "bg-(--brd)"
                            }`} />
                          ))}
                        </div>
                        <p className="text-[10px] font-bold text-(--t2)">
                          {pwStrength <= 1 ? "Weak" : pwStrength === 2 ? "Medium" : pwStrength === 3 ? "Good" : "Strong"}
                        </p>
                      </div>
                    )}
                    <div className="relative">
                      <input
                        type={showConfirmPw ? "text" : "password"}
                        value={confirmPw}
                        onChange={e => setConfirmPw(e.target.value)}
                        placeholder="Repeat password..."
                        className={`w-full px-5 py-4 pr-12 rounded-2xl border bg-(--bg)/50 focus:ring-2 focus:bg-(--card) outline-none text-sm text-(--t1) transition-all ${
                          confirmPw && confirmPw !== newPw ? "border-red-500 focus:ring-red-500/30"
                          : confirmPw && confirmPw === newPw ? "border-green-500 focus:ring-green-500/30"
                          : "border-(--brd) focus:ring-blue-500"
                        }`}
                      />
                      <button type="button" onClick={() => setShowConfirmPw(p => !p)} className="absolute right-4 top-1/2 -translate-y-1/2 text-(--t2) hover:text-blue-600 transition-colors">
                        {showConfirmPw ? <EyeOff size={16} /> : <Eye size={16} />}
                      </button>
                      {confirmPw && confirmPw === newPw && (
                        <CheckCircle size={15} className="absolute right-12 top-1/2 -translate-y-1/2 text-green-500" />
                      )}
                    </div>
                    {pwError && (
                      <div className="px-4 py-3 rounded-2xl bg-red-500/10 border border-red-500/20 text-red-500 text-[11px] font-bold text-center">{pwError}</div>
                    )}
                    <button
                      onClick={applyNewPassword}
                      disabled={!newPw || !confirmPw || newPw !== confirmPw || newPw.length < 8}
                      className={`w-full py-5 rounded-[1.8rem] font-black uppercase shadow-lg transition-all active:scale-95 text-sm tracking-wider ${
                        newPw && confirmPw && newPw === confirmPw && newPw.length >= 8
                          ? "bg-blue-600 text-white hover:bg-blue-700 shadow-blue-500/20"
                          : "bg-(--brd) text-(--t2) cursor-not-allowed"
                      }`}
                    >
                      Set Password
                    </button>
                    <button onClick={closeReset} className="w-full text-[10px] font-black text-(--t2) hover:text-red-500 uppercase tracking-[0.2em] transition-all flex items-center justify-center gap-1.5">
                      <span>←</span> {t.auth.resetCancel}
                    </button>
                  </div>
                </>
              )}

              {/* Step: done */}
              {pwStep === "done" && (
                <>
                  <div className="w-16 h-16 bg-green-500/10 rounded-2xl flex items-center justify-center mb-6">
                    <CheckCircle size={32} className="text-green-500" />
                  </div>
                  <h2 className="text-2xl font-black text-(--t1) uppercase mb-2 tracking-tight">Done!</h2>
                  <p className="text-center text-(--t2) text-[10px] font-bold uppercase mb-8 leading-relaxed">
                    Your password has been updated successfully.
                  </p>
                  <button
                    onClick={closeReset}
                    className="w-full py-5 rounded-[1.8rem] bg-blue-600 text-white font-black uppercase shadow-lg hover:bg-blue-700 transition-all active:scale-95 text-sm tracking-wider"
                  >
                    Sign In
                  </button>
                </>
              )}

            </div>
          </div>
          </div>
        </>,
        document.body
      )}

      {/* SETTINGS BUTTON */}
      <div className="fixed bottom-4 right-4 sm:bottom-6 sm:right-6 z-[60]" ref={settingsRef}>
        <div
          className={`
            absolute bottom-16 right-0
            w-[calc(100vw-2rem)] max-w-[16rem]
            bg-(--card)/90 backdrop-blur-2xl rounded-3xl shadow-2xl border border-(--brd) p-5
            transition-all duration-300 origin-bottom-right
            ${
              isSettingsOpen
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
                <div
                  className={`w-10 h-5 rounded-full transition-all relative ${
                    isDark ? "bg-blue-600" : "bg-gray-400"
                  }`}
                >
                  <div
                    className={`absolute top-0 left-0 w-5 h-5 bg-white rounded-full shadow transition-all ${
                      isDark ? "translate-x-5" : "translate-x-0"
                    }`}
                  />
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
