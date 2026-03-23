"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState, FormEvent } from "react";
import { useLanguage } from "@/context/LanguageContext";
import { Eye, EyeOff } from "lucide-react";

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

const API_URL =
typeof window !== "undefined" && window.location.hostname === "localhost"
? "http://localhost:8000"
: "https://site-turing-crutchmasters-team-s.onrender.com";

export default function LoginPage() {
  const router = useRouter();
  const { t }  = useLanguage();

  const [login, setLogin]     = useState("");
  const [password, setPw]     = useState("");
  const [showPw, setShowPw]   = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError]     = useState("");
  const [mounted, setMounted] = useState(false);

  useEffect(() => { setTimeout(() => setMounted(true), 80); }, []);

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setError(""); setLoading(true);
    try {
      const res  = await fetch("http://localhost:8000/api/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ login, password }),
      });
      const data = await res.json();
      if (!res.ok) { setError(data.detail || "Login failed"); return; }

      localStorage.setItem("access_token", data.access_token);
      localStorage.setItem("user", JSON.stringify(data.user));

      /* ── → Main page ── */
      router.push("/main_page");
    } catch { setError("Server connection error"); }
    finally   { setLoading(false); }
  };

  return (
    <div style={{
      minHeight: "100vh", background: "var(--bg)",
      display: "flex", alignItems: "center", justifyContent: "center",
      position: "relative", overflow: "hidden",
      backgroundImage: "linear-gradient(rgba(45,91,227,.025) 1px,transparent 1px),linear-gradient(90deg,rgba(45,91,227,.025) 1px,transparent 1px)",
      backgroundSize: "40px 40px",
    }}>
      <ShieldWM />

      {/* Back */}
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

      {/* Card */}
      <div style={{
        position: "relative", zIndex: 10,
        width: "100%", maxWidth: 400,
        background: "var(--card)", borderRadius: 28,
        padding: "44px 40px 40px",
        boxShadow: "var(--sh-lg)", border: "1px solid var(--brd)",
        display: "flex", flexDirection: "column", alignItems: "center",
        opacity: mounted ? 1 : 0,
        transform: mounted ? "translateY(0)" : "translateY(-26px) scale(.97)",
        transition: "opacity 500ms var(--spring), transform 500ms var(--spring)",
      }}>
        <h1 className="fu d50" style={{
          fontFamily: "var(--font)", fontSize: 32, fontWeight: 900,
          color: "var(--t1)", letterSpacing: "-.01em",
          textTransform: "uppercase", marginBottom: 32, textAlign: "center",
        }}>
          CODE FUTURE
        </h1>

        <form onSubmit={handleSubmit} style={{ width: "100%", display: "flex", flexDirection: "column", gap: 12 }}>
          {/* Login field */}
          <div className="fu d100" style={{ display: "flex", flexDirection: "column", gap: 5 }}>
            <label style={{ fontSize: 10, fontWeight: 800, color: "var(--t3)", textTransform: "uppercase", letterSpacing: ".08em" }}>
              {t.auth.login}
            </label>
            <input type="text" className={`inp ${error ? "err" : ""}`}
              placeholder={`${t.auth.login} ...`}
              value={login} onChange={e => setLogin(e.target.value)} required />
          </div>

          {/* Password field */}
          <div className="fu d150" style={{ display: "flex", flexDirection: "column", gap: 5 }}>
            <label style={{ fontSize: 10, fontWeight: 800, color: "var(--t3)", textTransform: "uppercase", letterSpacing: ".08em" }}>
              {t.auth.password}
            </label>
            <div style={{ position: "relative" }}>
              <input type={showPw ? "text" : "password"}
                className={`inp ${error ? "err" : ""}`}
                placeholder={`${t.auth.password} ...`}
                value={password} onChange={e => setPw(e.target.value)}
                style={{ paddingRight: 46 }} required />
              <button type="button" onClick={() => setShowPw(!showPw)} style={{
                position: "absolute", right: 14, top: "50%", transform: "translateY(-50%)",
                background: "none", border: "none", cursor: "pointer",
                color: "var(--t3)", transition: "color 150ms ease", padding: 0,
              }}
                onMouseEnter={e => (e.currentTarget.style.color = "var(--accent)")}
                onMouseLeave={e => (e.currentTarget.style.color = "var(--t3)")}
              >
                {showPw ? <EyeOff size={17}/> : <Eye size={17}/>}
              </button>
            </div>
          </div>

          {/* Error */}
          {error && (
            <div className="pop shake" style={{
              background: "rgba(239,68,68,.07)", border: "1px solid rgba(239,68,68,.2)",
              borderRadius: 12, padding: "10px 14px",
              fontSize: 12, color: "#dc2626", fontWeight: 700,
            }}>
              {error}
            </div>
          )}

          {/* Submit */}
          <button type="submit" disabled={loading || !login || !password}
            className="btn-p spr fu d250"
            style={{ width: "100%", padding: "15px", marginTop: 8, fontSize: 15 }}>
            {loading
              ? <span style={{ display:"flex", alignItems:"center", justifyContent:"center", gap:8 }}>
                  <span style={{ width:14, height:14, border:"2px solid rgba(255,255,255,.35)", borderTopColor:"#fff", borderRadius:"50%", display:"inline-block", animation:"spin .65s linear infinite" }}/>
                  ...
                </span>
              : t.auth.loginBtn}
          </button>
        </form>

        {/* Link to register */}
        <p className="fu d300" style={{ marginTop: 24, fontSize: 13, color: "var(--t3)", textAlign: "center" }}>
          {t.auth.noAccount}{" "}
          {/* ── → Register page ── */}
          <Link href="/register" style={{
            color: "var(--accent)", fontWeight: 800,
            textDecoration: "none", transition: "color 150ms ease",
          }}
            onMouseEnter={e => (e.currentTarget.style.color = "var(--accent-h)")}
            onMouseLeave={e => (e.currentTarget.style.color = "var(--accent)")}
          >
            {t.auth.toSignUp}
          </Link>
        </p>
      </div>

      <style>{`@keyframes spin{to{transform:rotate(360deg)}}`}</style>
    </div>
  );
}