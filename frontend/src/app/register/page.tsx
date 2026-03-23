"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, ChangeEvent, FormEvent, useEffect, useMemo } from "react";
import { useLanguage } from "@/context/LanguageContext";
import { createBrowserClient } from "@supabase/ssr";
import { Eye, EyeOff, ShieldCheck, ArrowLeft } from "lucide-react";

/* ── Shield SVG (shared markup) ── */
function ShieldWM() {
  return (
    <div className="shield-wm">
      <svg viewBox="0 0 200 230" fill="none" style={{ width:"min(70vw,560px)", height:"auto" }}>
        <path d="M100 10L190 50V110C190 160 150 200 100 220C50 200 10 160 10 110V50L100 10Z" fill="#1a2035"/>
        <path d="M100 30L175 64V110C175 152 142 186 100 204C58 186 25 152 25 110V64L100 30Z"
          fill="none" stroke="white" strokeWidth="4" strokeOpacity=".15"/>
        <path d="M82 115L95 128L122 98" stroke="white" strokeWidth="8"
          strokeLinecap="round" strokeLinejoin="round" strokeOpacity=".3"/>
      </svg>
    </div>
  );
}

function pwStrength(pw: string) {
  let s = 0;
  if (pw.length >= 8) s++;
  if (/[A-Z]/.test(pw)) s++;
  if (/[0-9]/.test(pw)) s++;
  if (/[^A-Za-z0-9]/.test(pw)) s++;
  return s;
}

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
  const router = useRouter();
  const { t }  = useLanguage();

  const supabase = useMemo(() => createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL ?? "",
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? ""
  ), []);

  const [form, setForm]       = useState({ username:"", login:"", email:"", password:"", confirmPassword:"" });
  const [showPw, setShowPw]   = useState(false);
  const [showCPw, setShowCPw] = useState(false);
  const [agreed, setAgreed]   = useState(false);
  const [showOtp, setShowOtp] = useState(false);
  const [otp, setOtp]         = useState("");
  const [loading, setLoading] = useState(false);
  const [mounted, setMounted] = useState(false);

  const isMatch   = form.password === form.confirmPassword;
  const pwOk      = form.password.length > 0;
  const canSubmit = agreed && isMatch && pwOk && !loading;
  const strength  = pwStrength(form.password);
  const sColor    = ["#c8cdd8","#ef4444","#f59e0b","#3b82f6","#22c55e"][strength];
  const sLabel    = ["","Слабкий","Середній","Добрий","Відмінний"][strength];

  useEffect(() => { setTimeout(() => setMounted(true), 80); }, []);

  const handleChange = (e: ChangeEvent<HTMLInputElement>) =>
    setForm(p => ({ ...p, [e.target.name]: e.target.value }));

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (!canSubmit) return;
    setLoading(true);
    try {
      const { error } = await supabase.auth.signUp({
        email: form.email, password: form.password,
        options: { data: { username: form.username, login: form.login } },
      });
      if (error) throw error;
      setShowOtp(true);
    } catch (err: any) { alert(err.message || "Registration failed"); }
    finally { setLoading(false); }
  };

  const handleVerify = async () => {
    if (otp.length !== 6) return;
    setLoading(true);
    try {
      const { error } = await supabase.auth.verifyOtp({
        email: form.email, token: otp, type: "signup",
      });
      if (error) throw error;

      const res = await fetch("http://localhost:8000/api/register", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          username: form.username, login: form.login,
          email: form.email, password: form.password,
        }),
      });
      if (!res.ok) { const d = await res.json(); throw new Error(d.detail); }

      /* ── → Login page ── */
      router.push("/login");
    } catch (err: any) { alert(err.message || "Verification failed"); }
    finally { setLoading(false); }
  };

  /* card transition style */
  const cardStyle: React.CSSProperties = {
    position: "relative", zIndex: 10,
    width: "100%", maxWidth: 440,
    background: "var(--card)", borderRadius: 28,
    padding: "44px 38px 38px",
    boxShadow: "var(--sh-lg)", border: "1px solid var(--brd)",
    display: "flex", flexDirection: "column", alignItems: "center",
    opacity: mounted ? 1 : 0,
    transform: mounted ? "translateY(0)" : "translateY(-26px) scale(.97)",
    transition: "opacity 500ms var(--spring), transform 500ms var(--spring)",
  };

  return (
    <div style={{
      minHeight: "100vh", background: "var(--bg)",
      display: "flex", alignItems: "center", justifyContent: "center",
      position: "relative", overflow: "hidden", padding: "32px 16px",
    }}>
      <ShieldWM />

      {!showOtp && (
        <Link href="/" className="sl" style={{
          position: "absolute", top: 28, left: 32, zIndex: 20,
          display: "flex", alignItems: "center", gap: 6,
          fontSize: 11, fontWeight: 800, color: "var(--t3)",
          textDecoration: "none", textTransform: "uppercase", letterSpacing: ".15em",
          transition: "color 150ms ease",
        }}
          onMouseEnter={e => (e.currentTarget.style.color = "var(--accent)")}
          onMouseLeave={e => (e.currentTarget.style.color = "var(--t3)")}
        >
          ← {t.nav.backHome}
        </Link>
      )}

      {/* ── REGISTER FORM ── */}
      {!showOtp ? (
        <div style={cardStyle}>
          <h1 className="fu d50" style={{
            fontFamily: "var(--font)", fontSize: 32, fontWeight: 900,
            color: "var(--t1)", letterSpacing: "-.01em",
            textTransform: "uppercase", marginBottom: 28, textAlign: "center",
          }}>
            CODE FUTURE
          </h1>

          <form onSubmit={handleSubmit} style={{ width: "100%", display: "flex", flexDirection: "column", gap: 10 }}>
            <input name="username" type="text" className="inp fu d50"
              placeholder={`${t.auth.username} ...`} value={form.username} onChange={handleChange} required />
            <input name="login" type="text" className="inp fu d100"
              placeholder={`${t.auth.login} ...`} value={form.login} onChange={handleChange} required />
            <input name="email" type="email" className="inp fu d150"
              placeholder="gmail ..." value={form.email} onChange={handleChange} required />

            {/* Passwords */}
            <div className="fu d200" style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
              <div style={{ position: "relative" }}>
                <input name="password" type={showPw ? "text" : "password"}
                  className="inp" placeholder={`${t.auth.password} ...`}
                  value={form.password} onChange={handleChange}
                  style={{ paddingRight: 40 }} required />
                <button type="button" onClick={() => setShowPw(!showPw)} style={{
                  position: "absolute", right: 12, top: "50%", transform: "translateY(-50%)",
                  background: "none", border: "none", cursor: "pointer", color: "var(--t3)", padding: 0,
                  transition: "color 150ms ease",
                }}
                  onMouseEnter={e => (e.currentTarget.style.color = "var(--accent)")}
                  onMouseLeave={e => (e.currentTarget.style.color = "var(--t3)")}
                >{showPw ? <EyeOff size={16}/> : <Eye size={16}/>}</button>
              </div>
              <div style={{ position: "relative" }}>
                <input name="confirmPassword" type={showCPw ? "text" : "password"}
                  className={`inp ${form.confirmPassword && !isMatch ? "err" : form.confirmPassword && isMatch ? "ok" : ""}`}
                  placeholder="cont. pass..." value={form.confirmPassword} onChange={handleChange}
                  style={{ paddingRight: 40 }} required />
                <button type="button" onClick={() => setShowCPw(!showCPw)} style={{
                  position: "absolute", right: 12, top: "50%", transform: "translateY(-50%)",
                  background: "none", border: "none", cursor: "pointer", color: "var(--t3)", padding: 0,
                  transition: "color 150ms ease",
                }}
                  onMouseEnter={e => (e.currentTarget.style.color = "var(--accent)")}
                  onMouseLeave={e => (e.currentTarget.style.color = "var(--t3)")}
                >{showCPw ? <EyeOff size={16}/> : <Eye size={16}/>}</button>
              </div>
            </div>

            {/* Password strength */}
            {form.password && (
              <div className="fu" style={{ display: "flex", alignItems: "center", gap: 8 }}>
                <div style={{ flex: 1, height: 3, background: "#e5e7eb", borderRadius: 99, overflow: "hidden" }}>
                  <div className="pw-bar" style={{ width: `${strength * 25}%`, background: sColor }} />
                </div>
                <span style={{ fontSize: 10, fontWeight: 800, color: sColor, textTransform: "uppercase", letterSpacing: ".06em", whiteSpace: "nowrap" }}>{sLabel}</span>
              </div>
            )}

            {/* Checkbox */}
            <div className="fu d250" style={{ display: "flex", alignItems: "center", gap: 10, padding: "4px 0" }}>
              <div onClick={() => setAgreed(!agreed)} style={{
                width: 20, height: 20, borderRadius: 5, flexShrink: 0, cursor: "pointer",
                border: agreed ? "none" : "2px solid var(--brd2)",
                background: agreed ? "var(--accent)" : "transparent",
                display: "flex", alignItems: "center", justifyContent: "center",
                transition: "background 160ms ease, border 160ms ease, transform 160ms var(--spring)",
                transform: agreed ? "scale(1.1)" : "scale(1)",
                boxShadow: agreed ? "0 3px 10px rgba(45,91,227,.35)" : "none",
              }}>
                {agreed && <svg width="11" height="11" viewBox="0 0 11 11" fill="none">
                  <path d="M2 5.5L4.5 8L9 3" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                </svg>}
              </div>
              <label onClick={() => setAgreed(!agreed)} style={{ fontSize: 13, color: "var(--t2)", fontStyle: "italic", fontWeight: 600, cursor: "pointer" }}>
                Personal (Privacy Policy)
              </label>
            </div>

            <button type="submit" disabled={!canSubmit} className="btn-p spr fu d300"
              style={{ width: "100%", padding: "15px", marginTop: 6, fontSize: 15 }}>
              {loading
                ? <span style={{ display:"flex", alignItems:"center", justifyContent:"center", gap:8 }}>
                    <span style={{ width:14, height:14, border:"2px solid rgba(255,255,255,.35)", borderTopColor:"#fff", borderRadius:"50%", display:"inline-block", animation:"spin .65s linear infinite" }}/>
                    ...
                  </span>
                : t.auth.registerBtn}
            </button>
          </form>

          <p className="fu d350" style={{ marginTop: 22, fontSize: 13, color: "var(--t3)", textAlign: "center" }}>
            Already have an account?{" "}
            {/* ── → Login page ── */}
            <Link href="/login" style={{ color: "var(--accent)", fontWeight: 800, textDecoration: "none", transition: "color 150ms ease" }}
              onMouseEnter={e => (e.currentTarget.style.color = "var(--accent-h)")}
              onMouseLeave={e => (e.currentTarget.style.color = "var(--accent)")}
            >sign in</Link>
          </p>
        </div>

      /* ── OTP SCREEN ── */
      ) : (
        <div className="otp" style={{
          position: "relative", zIndex: 10,
          width: "100%", maxWidth: 360,
          background: "var(--card)", borderRadius: 28, padding: "44px 36px",
          boxShadow: "var(--sh-lg)", border: "1px solid var(--brd)",
          display: "flex", flexDirection: "column", alignItems: "center",
        }}>
          <div className="pop" style={{
            width: 64, height: 64, borderRadius: 18, marginBottom: 20,
            background: "rgba(45,91,227,.08)", border: "1px solid rgba(45,91,227,.2)",
            display: "flex", alignItems: "center", justifyContent: "center",
          }}>
            <ShieldCheck size={30} color="var(--accent)" />
          </div>

          <h2 className="fu" style={{ fontFamily:"var(--font)", fontSize:24, fontWeight:900, color:"var(--t1)", textTransform:"uppercase", letterSpacing:"-.01em", marginBottom:6 }}>
            Verify
          </h2>
          <p className="fu d50" style={{ fontSize:12, color:"var(--t3)", fontWeight:700, textAlign:"center", marginBottom:28, textTransform:"uppercase", letterSpacing:".08em" }}>
            Код надіслано на{" "}<span style={{ color:"var(--accent)" }}>{form.email}</span>
          </p>

          <input type="text" maxLength={6} value={otp}
            onChange={e => setOtp(e.target.value.replace(/\D/g, ""))}
            className="otp-inp fu d100" placeholder="000000"
            style={{ marginBottom: 16 }}
          />

          {/* Progress dots */}
          <div className="fu d150" style={{ display:"flex", gap:7, marginBottom:24 }}>
            {Array.from({ length: 6 }).map((_, i) => (
              <div key={i} style={{
                width:9, height:9, borderRadius:"50%",
                background: i < otp.length ? "var(--accent)" : "var(--bg2)",
                border: "1px solid var(--brd2)",
                transition: "background 200ms ease, transform 200ms var(--spring)",
                transform: i < otp.length ? "scale(1.35)" : "scale(1)",
              }} />
            ))}
          </div>

          <button onClick={handleVerify} disabled={otp.length !== 6 || loading}
            className="btn-p" style={{ width:"100%", padding:"14px", marginBottom:12, fontSize:15 }}>
            {loading
              ? <span style={{ display:"flex", alignItems:"center", justifyContent:"center", gap:8 }}>
                  <span style={{ width:14, height:14, border:"2px solid rgba(255,255,255,.35)", borderTopColor:"#fff", borderRadius:"50%", display:"inline-block", animation:"spin .65s linear infinite" }}/>
                  Перевірка...
                </span>
              : "Confirm"}
          </button>

          <button onClick={() => { setShowOtp(false); setOtp(""); }}
            className="btn-g spr"
            style={{ width:"100%", padding:"11px", fontSize:13, display:"flex", alignItems:"center", justifyContent:"center", gap:6 }}>
            <ArrowLeft size={13}/> Назад
          </button>
        </div>
      )}
    </div>
  );
}