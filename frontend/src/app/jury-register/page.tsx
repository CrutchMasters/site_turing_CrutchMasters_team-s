//src/app/jury-register/page.tsx
"use client";

import { useState, useEffect, useMemo, Suspense } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import { createBrowserClient } from "@supabase/ssr";
import { useAuth } from "@/context/AuthContext";
import { useTheme } from "@/hooks/useTheme";
import { Shield, Star, Lock, Eye, EyeOff, Loader, AlertCircle, CheckCircle } from "lucide-react";

const API_URL =
  typeof window !== "undefined" && window.location.hostname === "localhost"
    ? "http://localhost:8000"
    : "https://site-turing-crutchmasters-team-s.onrender.com";

interface InviteInfo {
  email: string;
  round_id: string;
  round_name?: string;
  round_number?: number;
  tournament_id: string;
  tournament_name: string;
}

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

function JuryRegisterContent() {
  const searchParams  = useSearchParams();
  const router        = useRouter();
  const { login: authLogin } = useAuth();
  const { dark }      = useTheme();
  const token         = searchParams.get("token") ?? "";

  const supabase = useMemo(() => createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL ?? "",
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? ""
  ), []);

  // Token validation state
  const [validating, setValidating]   = useState(true);
  const [inviteInfo, setInviteInfo]   = useState<InviteInfo | null>(null);
  const [tokenError, setTokenError]   = useState<string | null>(null);

  // Form state
  const [username, setUsername]       = useState("");
  const [login, setLogin]             = useState("");
  const [password, setPassword]       = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showPw, setShowPw]           = useState(false);
  const [showCpw, setShowCpw]         = useState(false);
  const [agreed, setAgreed]           = useState(false);
  const [formError, setFormError]     = useState<string | null>(null);
  const [loading, setLoading]         = useState(false);

  // OTP state
  const [showOtp, setShowOtp]         = useState(false);
  const [otp, setOtp]                 = useState("");
  const [otpError, setOtpError]       = useState<string | null>(null);

  // Success state
  const [success, setSuccess]         = useState(false);

  // ── Step 0: validate token ─────────────────────────────────────────────
  useEffect(() => {
    if (!token) {
      setTokenError("Посилання не містить токен запрошення.");
      setValidating(false);
      return;
    }
    (async () => {
      try {
        const res = await fetch(`${API_URL}/api/jury-register/validate?token=${token}`);
        const data = await res.json();
        if (!res.ok) {
          setTokenError(data.detail ?? "Невалідне або прострочене посилання.");
        } else {
          setInviteInfo(data as InviteInfo);
        }
      } catch {
        setTokenError("Не вдалося перевірити посилання. Спробуйте ще раз.");
      } finally {
        setValidating(false);
      }
    })();
  }, [token]);

  const pwStrength = (() => {
    if (!password) return null;
    let s = 0;
    if (password.length >= 8) s++;
    if (/[A-Z]/.test(password)) s++;
    if (/[0-9]/.test(password)) s++;
    if (/[^A-Za-z0-9]/.test(password)) s++;
    return s;
  })();

  const canSubmit =
    agreed &&
    username.trim() &&
    login.trim() &&
    password.length >= 6 &&
    password === confirmPassword &&
    !loading;

  // ── Step 1: register ───────────────────────────────────────────────────
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!canSubmit || !inviteInfo) return;
    setLoading(true);
    setFormError(null);

    try {
      // Check login uniqueness
      const { data: existingLogin } = await supabase
        .from("account")
        .select("id")
        .eq("login", login.trim())
        .maybeSingle();
      if (existingLogin) { setFormError("Цей логін вже зайнятий."); return; }

      // Sign up — email is locked from invite
      const { error } = await supabase.auth.signUp({
        email: inviteInfo.email,
        password,
        options: {
          data: { username: username.trim(), login: login.trim() },
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
    } catch (err: any) {
      setFormError(err.message ?? "Помилка реєстрації");
    } finally {
      setLoading(false);
    }
  };

  // ── Step 2: OTP verify + complete ─────────────────────────────────────
  const handleOtpVerify = async () => {
    if (otp.length !== 6 || !inviteInfo) return;
    setLoading(true);
    setOtpError(null);

    try {
      const { data: verifyData, error: verifyError } = await supabase.auth.verifyOtp({
        email: inviteInfo.email,
        token: otp,
        type: "signup",
      });

      if (verifyError) throw verifyError;
      if (!verifyData.session) throw new Error("Сесія не отримана після верифікації");

      const accessToken  = verifyData.session.access_token;
      const refreshToken = verifyData.session.refresh_token;

      // Wait for trigger to create account row
      let accountData: any = null;
      for (let attempt = 0; attempt < 6; attempt++) {
        if (attempt > 0) await new Promise(r => setTimeout(r, 700));
        const { data } = await supabase
          .from("account")
          .select("id, username, login, email, role, status, avatar_url")
          .eq("email", inviteInfo.email)
          .maybeSingle();
        if (data) { accountData = data; break; }
      }

      if (!accountData) throw new Error("Не вдалося отримати дані акаунту після реєстрації");

      // Call backend to set jury role + jury_assignment for the round
      const completeRes = await fetch(
        `${API_URL}/api/jury-register/complete?token=${token}`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${accessToken}`,
          },
        }
      );
      if (!completeRes.ok) {
        const errData = await completeRes.json();
        throw new Error(errData.detail ?? "Помилка активації запрошення");
      }

      // Re-fetch account to get updated role
      const { data: updatedAccount } = await supabase
        .from("account")
        .select("id, username, login, email, role, status, avatar_url")
        .eq("email", inviteInfo.email)
        .maybeSingle();

      const finalAccount = updatedAccount ?? accountData;

      const userData = {
        id:         finalAccount.id,
        email:      finalAccount.email,
        username:   finalAccount.username,
        login:      finalAccount.login,
        role:       (finalAccount.role ?? "jury") as "user" | "admin" | "jury" | "superadmin",
        status:     finalAccount.status,
        avatar_url: finalAccount.avatar_url,
      };

      authLogin(userData, accessToken, refreshToken);
      setSuccess(true);

      // Redirect to the round evaluate page after short delay
      await new Promise(r => setTimeout(r, 2000));
      router.push(`/jury/rounds/${inviteInfo.round_id}/evaluate`);

    } catch (err: any) {
      setOtpError(err.message ?? "Помилка верифікації");
    } finally {
      setLoading(false);
    }
  };

  const inputClass =
    "w-full px-5 py-4 rounded-2xl border border-(--brd) bg-(--bg)/50 focus:ring-2 focus:ring-blue-500 focus:bg-(--card) outline-none text-sm text-(--t1) transition-all";

  // ── Validating ─────────────────────────────────────────────────────────
  if (validating) {
    return (
      <div className="min-h-screen bg-(--bg) flex items-center justify-center">
        <Loader className="w-8 h-8 text-blue-500 animate-spin" />
      </div>
    );
  }

  // ── Token error ────────────────────────────────────────────────────────
  if (tokenError) {
    return (
      <div className="min-h-screen bg-(--bg) flex items-center justify-center px-4">
        <div className="w-full max-w-md bg-(--card)/70 backdrop-blur-2xl p-8 rounded-[2rem] shadow-2xl border border-(--brd) flex flex-col items-center text-center gap-5">
          <div className="w-14 h-14 rounded-2xl bg-red-500/10 border border-red-500/20 flex items-center justify-center">
            <AlertCircle size={24} className="text-red-500" />
          </div>
          <div>
            <h1 className="text-xl font-black text-(--t1) uppercase mb-2">Посилання недійсне</h1>
            <p className="text-sm text-(--t2) font-medium">{tokenError}</p>
          </div>
          <button
            onClick={() => router.push("/")}
            className="px-6 py-3 rounded-2xl bg-blue-600 text-white font-black text-sm uppercase tracking-widest hover:bg-blue-700 transition-all"
          >
            На головну
          </button>
        </div>
      </div>
    );
  }

  // ── Success ────────────────────────────────────────────────────────────
  if (success) {
    const roundLabel = inviteInfo?.round_name || (inviteInfo?.round_number ? `Раунд ${inviteInfo.round_number}` : "раунд");
    return (
      <div className="min-h-screen bg-(--bg) flex items-center justify-center px-4">
        <div className="w-full max-w-md bg-(--card)/70 backdrop-blur-2xl p-8 rounded-[2rem] shadow-2xl border border-green-500/20 flex flex-col items-center text-center gap-5">
          <div className="w-14 h-14 rounded-2xl bg-green-500/10 border border-green-500/20 flex items-center justify-center">
            <CheckCircle size={24} className="text-green-500" />
          </div>
          <div>
            <h1 className="text-xl font-black text-(--t1) uppercase mb-2">Вітаємо!</h1>
            <p className="text-sm text-(--t2) font-medium">
              Ви успішно зареєстровані як журі для{" "}
              <span className="font-black text-(--t1)">«{roundLabel}»</span> турніру{" "}
              <span className="font-black text-(--t1)">«{inviteInfo?.tournament_name}»</span>.
              Переходимо до оцінювання...
            </p>
          </div>
          <Loader className="w-6 h-6 text-green-500 animate-spin" />
        </div>
      </div>
    );
  }

  const roundLabel = inviteInfo?.round_name || (inviteInfo?.round_number ? `Раунд ${inviteInfo.round_number}` : "раунд");

  return (
    <div className="min-h-screen bg-(--bg) flex flex-col items-center justify-center font-sans text-(--t1) relative overflow-hidden px-4 py-10">

      {/* Background watermark */}
      <div className={`fixed inset-0 flex items-center justify-center pointer-events-none z-0 ${dark ? "opacity-10" : "opacity-5"}`}>
        <img src="/logo_background1.png" alt="" className={`w-[min(700px,90vw)] h-[min(700px,90vw)] object-contain blur-sm ${dark ? "invert" : ""}`} />
      </div>

      <div className="z-10 w-full max-w-md flex flex-col gap-4">

        {/* Invite info card */}
        {inviteInfo && (
          <div className="bg-(--card)/80 backdrop-blur-xl rounded-[1.5rem] border border-amber-500/20 p-5 flex items-start gap-4">
            <div className="w-10 h-10 rounded-xl bg-amber-500/15 border border-amber-500/20 flex items-center justify-center flex-shrink-0 mt-0.5">
              <Star size={18} className="text-amber-500" />
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-[10px] font-black uppercase tracking-widest text-amber-500 mb-1">
                Запрошення до журі
              </p>
              <p className="text-sm font-black text-(--t1) truncate">{inviteInfo.tournament_name}</p>
              <p className="text-[11px] font-bold text-(--t2) mt-0.5">{roundLabel}</p>
            </div>
          </div>
        )}

        {!showOtp ? (
          /* ── Registration form ── */
          <div className="bg-(--card)/70 backdrop-blur-2xl p-8 rounded-[2rem] shadow-2xl border border-(--brd) flex flex-col items-center">
            <div className="w-12 h-12 rounded-2xl bg-blue-600/10 border border-blue-600/20 flex items-center justify-center mb-5">
              <Shield size={22} className="text-blue-600" />
            </div>
            <h1 className="text-2xl font-black text-(--t1) uppercase tracking-tighter mb-1 text-center">
              Реєстрація журі
            </h1>
            <p className="text-[11px] text-(--t2) font-bold text-center mb-7 uppercase tracking-wider">
              Заповніть дані для входу на платформу
            </p>

            <form onSubmit={handleSubmit} className="w-full flex flex-col gap-3">
              {/* Username */}
              <input
                type="text"
                placeholder="Повне ім'я"
                value={username}
                onChange={e => setUsername(e.target.value)}
                className={inputClass}
                required
              />

              {/* Login */}
              <input
                type="text"
                placeholder="Логін (нікнейм)"
                value={login}
                onChange={e => setLogin(e.target.value.replace(/\s/g, ""))}
                className={inputClass}
                required
              />

              {/* Email — locked */}
              <div className="relative">
                <input
                  type="email"
                  value={inviteInfo?.email ?? ""}
                  readOnly
                  className={`${inputClass} pr-10 opacity-70 cursor-not-allowed select-none`}
                  tabIndex={-1}
                />
                <Lock size={14} className="absolute right-4 top-1/2 -translate-y-1/2 text-(--t2)" />
              </div>
              <p className="text-[10px] text-(--t2) font-medium -mt-1 px-1">
                Email заблоковано — він прив'язаний до вашого запрошення
              </p>

              {/* Password */}
              <div className="flex flex-col gap-2">
                <div className="relative">
                  <input
                    type={showPw ? "text" : "password"}
                    placeholder="Пароль (мін. 6 символів)"
                    value={password}
                    onChange={e => setPassword(e.target.value)}
                    className="w-full px-4 py-4 pr-10 rounded-2xl border border-(--brd) bg-(--bg)/50 focus:ring-2 focus:ring-blue-500 focus:bg-(--card) outline-none text-sm text-(--t1)"
                    required
                  />
                  <button type="button" onClick={() => setShowPw(!showPw)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-(--t2) hover:text-blue-500 transition-colors">
                    {showPw ? <EyeOffIcon /> : <EyeIcon />}
                  </button>
                </div>
                {pwStrength !== null && (
                  <div className="px-1 space-y-1">
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

              {/* Confirm password */}
              <div className="relative">
                <input
                  type={showCpw ? "text" : "password"}
                  placeholder="Підтвердіть пароль"
                  value={confirmPassword}
                  onChange={e => setConfirmPassword(e.target.value)}
                  className={`w-full px-4 py-4 pr-10 rounded-2xl border bg-(--bg)/50 focus:ring-2 focus:bg-(--card) outline-none text-sm text-(--t1) ${
                    confirmPassword && password !== confirmPassword ? "border-red-500" : "border-(--brd)"
                  }`}
                  required
                />
                <button type="button" onClick={() => setShowCpw(!showCpw)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-(--t2) hover:text-blue-500 transition-colors">
                  {showCpw ? <EyeOffIcon /> : <EyeIcon />}
                </button>
              </div>

              {/* Privacy */}
              <div className="flex items-center gap-3 py-1">
                <input type="checkbox" id="privacy" checked={agreed} onChange={() => setAgreed(!agreed)}
                  className="w-5 h-5 cursor-pointer accent-blue-600 rounded-lg flex-shrink-0" />
                <label htmlFor="privacy" className="text-[11px] font-bold text-(--t2) cursor-pointer uppercase tracking-wider">
                  Погоджуюсь з{" "}
                  <a href="/privacy_policy" target="_blank" className="text-blue-600 hover:underline" onClick={e => e.stopPropagation()}>
                    Privacy Policy
                  </a>
                </label>
              </div>

              {/* Form error */}
              {formError && (
                <div className="px-4 py-3 rounded-2xl bg-red-500/10 border border-red-500/20 text-red-500 text-[11px] font-bold text-center flex items-center gap-2">
                  <AlertCircle size={13} /> {formError}
                </div>
              )}

              <button
                type="submit"
                disabled={!canSubmit}
                className={`w-full py-4 rounded-[1.5rem] text-lg font-black shadow-xl transition-all active:scale-95 uppercase tracking-tighter ${
                  canSubmit ? "bg-blue-600 text-white hover:bg-blue-700 shadow-blue-500/20" : "bg-(--brd) text-(--t2) cursor-not-allowed"
                }`}
              >
                {loading ? <Loader className="w-5 h-5 animate-spin mx-auto" /> : "Зареєструватись"}
              </button>
            </form>
          </div>
        ) : (
          /* ── OTP verification ── */
          <div className="bg-(--card)/80 backdrop-blur-3xl p-10 rounded-[3rem] shadow-2xl border border-(--brd) flex flex-col items-center text-(--t1)">
            <div className="w-16 h-16 bg-blue-600/10 rounded-2xl flex items-center justify-center text-blue-600 mb-6">
              <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
              </svg>
            </div>
            <h2 className="text-2xl font-black uppercase mb-2">Verify</h2>
            <p className="text-center text-(--t2) text-[10px] font-bold uppercase mb-8">
              Введіть 6-значний код, надісланий на{" "}
              <span className="text-(--t1)">{inviteInfo?.email}</span>
            </p>

            <input
              type="text" maxLength={6} value={otp}
              onChange={e => { setOtp(e.target.value.replace(/\D/g, "")); setOtpError(null); }}
              placeholder="000000"
              className="w-full text-center text-4xl font-black tracking-[0.2em] py-5 rounded-2xl bg-(--bg)/50 focus:bg-(--card) focus:ring-2 focus:ring-blue-500 outline-none transition-all text-blue-600 mb-4 placeholder:text-(--t2)/30"
            />

            {otpError && (
              <div className="w-full mb-4 px-4 py-3 rounded-2xl bg-red-500/10 border border-red-500/20 text-red-500 text-[11px] font-bold text-center flex items-center gap-2 justify-center">
                <AlertCircle size={13} /> {otpError}
              </div>
            )}

            <button
              onClick={handleOtpVerify}
              disabled={otp.length !== 6 || loading}
              className={`w-full py-5 rounded-[1.8rem] font-black uppercase shadow-lg transition-all mb-4 ${
                otp.length === 6 && !loading ? "bg-blue-600 text-white shadow-blue-500/20" : "bg-(--brd) text-(--t2) cursor-not-allowed"
              }`}
            >
              {loading ? <Loader className="w-5 h-5 animate-spin mx-auto" /> : "Підтвердити"}
            </button>

            <button
              onClick={() => { setShowOtp(false); setOtp(""); setOtpError(null); }}
              className="text-[10px] font-black text-(--t2) hover:text-red-500 uppercase tracking-[0.3em] transition-all flex items-center gap-2"
            >
              <span>←</span> Назад
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

export default function JuryRegisterPage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen bg-(--bg) flex items-center justify-center">
        <Loader className="w-8 h-8 text-blue-500 animate-spin" />
      </div>
    }>
      <JuryRegisterContent />
    </Suspense>
  );
}
