"use client";

import React, { useState } from 'react';
import { useRouter } from 'next/navigation';
import {
  LayoutDashboard, Trophy, Users, UserCircle,
  Settings, LogOut, ExternalLink, Upload,
  ChevronRight, FileText
} from 'lucide-react';

/* ── Shield watermark ── */
function ShieldWM() {
  return (
    <div className="shield-wm">
      <svg viewBox="0 0 200 230" fill="none" style={{ width:"min(70vw,580px)", height:"auto" }}>
        <path d="M100 10L190 50V110C190 160 150 200 100 220C50 200 10 160 10 110V50L100 10Z" fill="#1a2035"/>
        <path d="M100 30L175 64V110C175 152 142 186 100 204C58 186 25 152 25 110V64L100 30Z"
          fill="none" stroke="white" strokeWidth="4" strokeOpacity=".15"/>
        <path d="M82 115L95 128L122 98" stroke="white" strokeWidth="8"
          strokeLinecap="round" strokeLinejoin="round" strokeOpacity=".3"/>
      </svg>
    </div>
  );
}

/* ── Sidebar ── */
function Sidebar({ onProfile }: { onProfile: () => void }) {
  const router = useRouter();

  const handleLogout = () => {
    localStorage.removeItem("access_token");
    localStorage.removeItem("user");
    router.push("/login");
  };

  return (
    <aside className="sidebar sl">
      <div style={{ padding:"18px 14px", borderBottom:"1px solid var(--brd)" }}>
        {/* ── Profile button → Profile page ── */}
        <button onClick={onProfile} className="spr"
          style={{ display:"flex", alignItems:"center", gap:11, width:"100%", padding:"9px 11px", borderRadius:13, background:"none", border:"none", cursor:"pointer", transition:"background 150ms ease" }}
          onMouseEnter={e => (e.currentTarget.style.background = "var(--bg)")}
          onMouseLeave={e => (e.currentTarget.style.background = "none")}
        >
          <div style={{
            width:36, height:36, borderRadius:"50%", flexShrink:0,
            background:"linear-gradient(135deg,var(--accent),#6b8ff7)",
            display:"flex", alignItems:"center", justifyContent:"center",
            color:"#fff", fontWeight:900, fontSize:13,
            boxShadow:"0 3px 10px rgba(45,91,227,.3)",
            transition:"transform 200ms var(--spring)",
          }}>
            AP
          </div>
          <div style={{ overflow:"hidden", textAlign:"left", flex:1 }}>
            <p style={{ fontSize:13, fontWeight:800, color:"var(--t1)", whiteSpace:"nowrap", overflow:"hidden", textOverflow:"ellipsis" }}>Anton Petrov</p>
            <p style={{ fontSize:10, color:"var(--accent)", textTransform:"uppercase", letterSpacing:".07em", fontWeight:700 }}>Профіль →</p>
          </div>
        </button>
      </div>

      <nav style={{ flex:1, padding:"10px", display:"flex", flexDirection:"column", gap:2 }}>
        {[
          { icon:<LayoutDashboard size={17}/>, label:"Dashboard", active:true },
          { icon:<Trophy size={17}/>,          label:"Турніри" },
          { icon:<Users size={17}/>,           label:"Команди" },
          { icon:<UserCircle size={17}/>,      label:"Гравці" },
          { icon:<Settings size={17}/>,        label:"Налаштування" },
        ].map((item, i) => (
          <button key={item.label}
            className={`nav-item sl d${(i+1)*50} ${item.active ? "active" : ""}`}>
            {item.icon}<span>{item.label}</span>
          </button>
        ))}
      </nav>

      <div style={{ padding:"10px", borderTop:"1px solid var(--brd)" }} className="fi d400">
        <button className="nav-item spr" style={{ color:"var(--t3)" }}
          onClick={handleLogout}
          onMouseEnter={e => (e.currentTarget.style.color = "#ef4444")}
          onMouseLeave={e => (e.currentTarget.style.color = "var(--t3)")}
        >
          <LogOut size={17}/><span>Вихід</span>
        </button>
      </div>
    </aside>
  );
}

/* ── Main page ── */
export default function MainPage() {
  const router = useRouter();

  /* ── → Profile page ── */
  const goProfile = () => router.push("/profile");

  return (
    <div style={{ display:"flex", minHeight:"100vh", background:"var(--bg)", position:"relative", overflow:"hidden" }}>
      <ShieldWM />
      <Sidebar onProfile={goProfile} />

      <main style={{ flex:1, padding:"32px 36px", overflowY:"auto", position:"relative", zIndex:1 }}>
        {/* Header */}
        <header className="fu" style={{ marginBottom:28 }}>
          <div style={{ display:"flex", alignItems:"center", gap:7, fontSize:11, color:"var(--t3)", marginBottom:6, fontWeight:700, textTransform:"uppercase", letterSpacing:".08em" }}>
            <span>Головна</span><ChevronRight size={11}/><span style={{ color:"var(--t2)" }}>Дашборд</span>
          </div>
          <h1 style={{ fontFamily:"var(--font)", fontSize:22, fontWeight:900, color:"var(--t1)", textTransform:"uppercase", letterSpacing:"-.02em" }}>
            Головна сторінка — Огляд
          </h1>
        </header>

        <div style={{ maxWidth:940, display:"flex", flexDirection:"column", gap:24 }}>

          {/* ── Tournaments table ── */}
          <section className="fu d100 cl" style={{
            background:"var(--card)", borderRadius:20,
            boxShadow:"var(--sh-md)", border:"1px solid var(--brd)", overflow:"hidden",
          }}>
            <div style={{ padding:"18px 24px", borderBottom:"1px solid var(--brd)", display:"flex", alignItems:"center", justifyContent:"space-between", flexWrap:"wrap", gap:12 }}>
              <h2 style={{ fontFamily:"var(--font)", fontWeight:900, fontSize:16, color:"var(--t1)", textTransform:"uppercase" }}>
                Список турнірів
              </h2>
              <div style={{ display:"flex", gap:6 }}>
                {["Всі","Registration Open","Running","Finished"].map((lbl, i) => (
                  <button key={lbl} className="spr" style={{
                    padding:"5px 12px", borderRadius:999, fontSize:11, fontWeight:800,
                    background: i===0 ? "var(--accent)" : "var(--bg)",
                    color: i===0 ? "#fff" : "var(--t2)",
                    border: i===0 ? "none" : "1.5px solid var(--brd2)",
                    cursor:"pointer",
                    boxShadow: i===0 ? "0 3px 12px rgba(45,91,227,.3)" : "none",
                    transition:"all 150ms ease",
                    textTransform:"uppercase", letterSpacing:".05em",
                  }}>{lbl}</button>
                ))}
              </div>
            </div>
            <table style={{ width:"100%", borderCollapse:"collapse" }}>
              <thead>
                <tr style={{ borderBottom:"1px solid var(--brd)", background:"rgba(0,0,0,.015)" }}>
                  {["Назва турніру","Статус","Дата старту","Ваша участь",""].map(h => (
                    <th key={h} style={{ padding:"10px 20px", textAlign: h==="" ? "right" : "left", fontSize:10, fontWeight:800, color:"var(--t3)", textTransform:"uppercase", letterSpacing:".08em", whiteSpace:"nowrap" }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {[
                  { title:"Весняний хакатон 2026", status:"Running",      cls:"b-run",  date:"12.01.2026", part:"Дати",  delay:200 },
                  { title:"Summer Code Jam",       status:"Registration", cls:"b-open", date:"02.01.2026", part:"—",     delay:280, special:true },
                ].map(row => (
                  <tr key={row.title} className="row" style={{ animationDelay:`${row.delay}ms`, cursor:"default" }}
                    onMouseEnter={e => Array.from(e.currentTarget.cells).forEach(c => (c.style.background="rgba(0,0,0,.015)"))}
                    onMouseLeave={e => Array.from(e.currentTarget.cells).forEach(c => (c.style.background=""))}
                  >
                    <td style={{ padding:"13px 20px", fontSize:13, color:"var(--t1)", fontWeight:800, borderBottom:"1px solid var(--brd)", whiteSpace:"nowrap" }}>{row.title}</td>
                    <td style={{ padding:"13px 20px", borderBottom:"1px solid var(--brd)", whiteSpace:"nowrap" }}>
                      <span className={`badge ${row.cls}`}>{row.status}</span>
                    </td>
                    <td style={{ padding:"13px 20px", fontSize:13, color:"var(--t2)", borderBottom:"1px solid var(--brd)", whiteSpace:"nowrap" }}>{row.date}</td>
                    <td style={{ padding:"13px 20px", fontSize:13, color:"var(--t2)", borderBottom:"1px solid var(--brd)", whiteSpace:"nowrap" }}>{row.part}</td>
                    <td style={{ padding:"13px 20px", borderBottom:"1px solid var(--brd)", textAlign:"right" }}>
                      {row.special ? (
                        <button className="btn-p spr" style={{ padding:"6px 14px", fontSize:11 }}>Зареєструватись</button>
                      ) : (
                        <button className="spr" style={{ background:"none", border:"none", cursor:"pointer", padding:6, borderRadius:8, color:"var(--t3)", transition:"color 150ms ease" }}
                          onMouseEnter={e => (e.currentTarget.style.color="var(--accent)")}
                          onMouseLeave={e => (e.currentTarget.style.color="var(--t3)")}
                        ><ExternalLink size={16}/></button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </section>

          {/* ── Team card ── */}
          <section className="fu d200 cl" style={{
            background:"var(--card)", borderRadius:20,
            boxShadow:"var(--sh-md)", border:"1px solid var(--brd)", padding:"24px",
          }}>
            <h2 style={{ fontFamily:"var(--font)", fontWeight:900, fontSize:16, color:"var(--t1)", marginBottom:18, display:"flex", alignItems:"center", gap:8, textTransform:"uppercase" }}>
              <Users size={18} color="var(--accent)"/> Команда: Team Alpha
            </h2>
            <div style={{ display:"grid", gridTemplateColumns:"repeat(3,1fr)", gap:12 }}>
              {[
                { label:"Поточний турнір", content:(
                    <div style={{ display:"flex", alignItems:"center", justifyContent:"space-between" }}>
                      <a href="#" style={{ fontWeight:800, fontSize:13, color:"var(--t1)", textDecoration:"none", display:"flex", alignItems:"center", gap:5, transition:"color 150ms ease" }}
                        onMouseEnter={e=>(e.currentTarget.style.color="var(--accent)")}
                        onMouseLeave={e=>(e.currentTarget.style.color="var(--t1)")}
                      >Весняний хакатон <ExternalLink size={12}/></a>
                      <span className="badge b-run" style={{ fontSize:9 }}>Running</span>
                    </div>
                  )},
                { label:"Ваше завдання", content:<p style={{ fontSize:13, fontWeight:600, color:"var(--t1)" }}>Створення API для авторизації</p> },
                { label:"Останній сабміт", content:(
                    <div style={{ display:"flex", alignItems:"center", gap:7, color:"var(--accent)" }}>
                      <FileText size={15}/><span style={{ fontSize:13, fontWeight:700, fontStyle:"italic" }}>v2_final_build.zip</span>
                    </div>
                  )},
              ].map((c, i) => (
                <div key={c.label} className={`su d${(i+2)*100}`}
                  style={{ background:"var(--bg)", borderRadius:14, padding:"14px 16px", border:"1px solid var(--brd)" }}>
                  <p style={{ fontSize:10, fontWeight:800, color:"var(--t3)", textTransform:"uppercase", letterSpacing:".08em", marginBottom:8 }}>{c.label}</p>
                  {c.content}
                </div>
              ))}
            </div>
            <div style={{ marginTop:18, paddingTop:18, borderTop:"1px solid var(--brd)", display:"flex", alignItems:"center", justifyContent:"space-between", gap:12 }}>
              <p style={{ fontSize:12, color:"var(--t3)", fontStyle:"italic" }}>
                <span style={{ color:"var(--t2)", fontStyle:"normal", fontWeight:700 }}>Статус:</span> Файли перевіряються автоматичною системою...
              </p>
              <button className="btn-p spr" style={{ padding:"11px 22px", display:"flex", alignItems:"center", gap:7, flexShrink:0 }}>
                <Upload size={15}/> Здати нову версію
              </button>
            </div>
          </section>

        </div>
      </main>
    </div>
  );
}
