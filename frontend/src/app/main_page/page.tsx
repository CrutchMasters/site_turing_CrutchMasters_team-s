"use client";

import { useRouter } from 'next/navigation';
import React, { useEffect, useRef } from 'react';
import {
  LayoutDashboard,
  Trophy,
  Users,
  UserCircle,
  Settings,
  LogOut,
  ExternalLink,
  Upload,
  ChevronRight,
  FileText
} from 'lucide-react';

export default function DashboardPage() {
  const revealRefs = useRef<(HTMLElement | null)[]>([]);
  const router = useRouter();
  useEffect(() => {
    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            entry.target.classList.add("fuIn");
          }
        });
      },
      { threshold: 0.1 }
    );

    revealRefs.current.forEach((ref) => {
      if (ref) observer.observe(ref);
    });

      return () => observer.disconnect();
  }, []);

  return (
    <div style={{ background: "#ebebee", color: "#1a2035" }} className="flex min-h-screen overflow-x-hidden">
    <style jsx global>{`
      @keyframes fadeUp {
        from { opacity: 0; transform: translateY(20px); }
        to { opacity: 1; transform: none; }
      }
      @keyframes cardDrop {
        from { opacity: 0; transform: translateY(-26px) scale(0.97); }
        to { opacity: 1; transform: none; }
      }
      .fuIn {
        animation: fadeUp 340ms cubic-bezier(0.22, 1, 0.36, 1) both;
      }
      .cdIn {
        animation: cardDrop 500ms cubic-bezier(0.22, 1, 0.36, 1) both;
      }
      .spr {
        transition: transform 170ms cubic-bezier(0.22, 1, 0.36, 1), box-shadow 170ms ease, background 150ms ease, color 150ms ease;
      }
      .spr:hover {
        transform: translateY(-2px) scale(1.025);
      }
      `}</style>

      {/* --- SIDEBAR --- */}
      <aside className="w-64 flex flex-col flex-shrink-0" style={{ background: "#ffffff", borderRight: "1px solid rgba(0,0,0,0.07)" }}>
      {/* Profile Card как кнопка для перехода */}
      <button
      onClick={() => router.push('/profile')}
      className="p-6 flex items-center gap-3 w-full text-left transition-colors hover:bg-gray-50 group"
      style={{ borderBottom: "1px solid rgba(0,0,0,0.07)" }}
      >
      <div className="w-10 h-10 rounded-full flex items-center justify-center text-white font-bold text-sm spr"
      style={{
        background: "linear-gradient(135deg, #2d5be3 0%, #1e47cc 100%)",
          boxShadow: "0 2px 8px rgba(0,0,0,0.06)",
      }}
      >
      AP
      </div>
      <div className="overflow-hidden">
      <p className="text-sm font-bold" style={{ color: "#1a2035" }}>Anton Petrov</p>
      <p className="text-[10px] uppercase tracking-wider font-bold" style={{ color: "#9aa0b0" }}>Admin Role</p>
      </div>
      </button>

      {/* Navigation */}
      <nav className="flex-1 p-4 space-y-1">
      <NavItem icon={<LayoutDashboard size={18} />} label="Dashboard" active />
      <NavItem icon={<Trophy size={18} />} label="Турніри" />
      <NavItem icon={<Users size={18} />} label="Команди" />
      <NavItem icon={<UserCircle size={18} />} label="Гравці" />
      <NavItem icon={<Settings size={18} />} label="Налаштування" />
      </nav>

      {/* Logout Button */}
      <div className="p-4 mt-auto" style={{ borderTop: "1px solid rgba(0,0,0,0.07)" }}>
      <button className="flex items-center gap-3 px-4 py-2.5 w-full text-sm font-bold spr rounded-xl transition-colors"
      style={{
        color: "#5a6278",
      }}
      onMouseEnter={(e) => e.currentTarget.style.color = "#2d5be3"}
      onMouseLeave={(e) => e.currentTarget.style.color = "#5a6278"}
      >
      <LogOut size={18} /> Вихід
      </button>
      </div>
      </aside>

      {/* --- MAIN CONTENT --- */}
      <main className="flex-1 p-8 overflow-y-auto">
      {/* Header */}
      <header className="mb-12">
      <div className="flex items-center gap-2 text-xs font-bold mb-3 uppercase tracking-wider" style={{ color: "#9aa0b0" }}>
      <span>Головна</span>
      <ChevronRight size={12} />
      <span style={{ color: "#5a6278" }}>Дашборд</span>
      </div>
      <h1 className="text-3xl font-black tracking-tight" style={{ color: "#1a2035" }}>
      8. Головна сторінка - Огляд
      </h1>
      </header>

      <div className="max-w-6xl space-y-8">

      {/* 1. СПИСОК ТУРНІРІВ */}
      <section
      ref={(el) => { revealRefs.current[0] = el; }}
      className="cdIn opacity-0 rounded-3xl overflow-hidden"
      style={{
        background: "#ffffff",
        border: "1.5px solid rgba(0,0,0,0.07)",
          boxShadow: "0 6px 24px rgba(0,0,0,0.09)",
      }}
      >
      {/* Header Section */}
      <div className="p-8 flex flex-col md:flex-row md:items-center justify-between gap-4" style={{ borderBottom: "1.5px solid rgba(0,0,0,0.07)" }}>
      <h2 className="font-black text-xl" style={{ color: "#1a2035" }}>
      🏆 Список турнірів
      </h2>
      <div className="flex flex-wrap gap-2">
      <FilterButton label="Всі" active />
      <FilterButton label="Registration Open" />
      <FilterButton label="Running" />
      <FilterButton label="Finished" />
      </div>
      </div>

      {/* Table */}
      <div className="overflow-x-auto">
      <table className="w-full text-left border-collapse">
      <thead>
      <tr style={{ background: "#ebebee", borderBottom: "1.5px solid rgba(0,0,0,0.07)" }}>
      <th className="px-8 py-4 text-[10px] font-black uppercase tracking-widest" style={{ color: "#9aa0b0" }}>Назва турніру</th>
      <th className="px-8 py-4 text-[10px] font-black uppercase tracking-widest" style={{ color: "#9aa0b0" }}>Статус</th>
      <th className="px-8 py-4 text-[10px] font-black uppercase tracking-widest" style={{ color: "#9aa0b0" }}>Дата старту</th>
      <th className="px-8 py-4 text-[10px] font-black uppercase tracking-widest" style={{ color: "#9aa0b0" }}>Ваша участь</th>
      <th className="px-8 py-4 text-[10px] font-black uppercase tracking-widest text-right" style={{ color: "#9aa0b0" }}>Дії</th>
      </tr>
      </thead>
      <tbody className="text-sm divide-y" style={{ borderColor: "rgba(0,0,0,0.07)" }}>
      <TournamentRow
      title="Весняний хакатон 2026"
      status="Running"
      statusType="warning"
      date="12.01.2026"
      participation="Дати"
      />
      <TournamentRow
      title="Summer Code Jam"
      status="Registration"
      statusType="info"
      date="02.01.2026"
      participation="—"
      isSpecialAction
      />
      </tbody>
      </table>
      </div>
      </section>

      {/* 2. КОМАНДА: TEAM ALPHA */}
      <section
      ref={(el) => { revealRefs.current[1] = el; }}
      className="cdIn opacity-0 rounded-3xl p-8 relative overflow-hidden"
      style={{
        background: "#ffffff",
        border: "1.5px solid rgba(0,0,0,0.07)",
          boxShadow: "0 6px 24px rgba(0,0,0,0.09)",
      }}
      >
      {/* Decorative element */}
      <div className="absolute -right-12 -top-12 w-40 h-40 rounded-full blur-3xl opacity-10" style={{ background: "#2d5be3" }} />

      <h2 className="font-black text-xl mb-8 flex items-center gap-3 relative z-10" style={{ color: "#1a2035" }}>
      <Users className="spr" style={{ color: "#2d5be3" }} size={24} />
      👥 Команда: Team Alpha
      </h2>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 relative z-10">
      {/* Current Tournament */}
      <div className="p-6 rounded-2xl spr"
      style={{
        background: "#ebebee",
        border: "1.5px solid rgba(0,0,0,0.07)",
      }}
      >
      <p className="text-[10px] font-black uppercase tracking-wider mb-3" style={{ color: "#9aa0b0" }}>Поточний турнір</p>
      <div className="flex items-start justify-between gap-2">
      <a href="#" className="font-bold text-base flex items-center gap-2 transition-colors"
      style={{ color: "#1a2035" }}
      onMouseEnter={(e) => e.currentTarget.style.color = "#2d5be3"}
      onMouseLeave={(e) => e.currentTarget.style.color = "#1a2035"}
      >
      Весняний хакатон 2026 <ExternalLink size={14} />
      </a>
      </div>
      <div className="mt-3 inline-block px-2 py-1 rounded text-[9px] font-black uppercase" style={{ background: "rgba(245,158,11,.12)", color: "#d97706" }}>
      Running
      </div>
      </div>

      {/* Your Task */}
      <div className="p-6 rounded-2xl spr"
      style={{
        background: "#ebebee",
        border: "1.5px solid rgba(0,0,0,0.07)",
      }}
      >
      <p className="text-[10px] font-black uppercase tracking-wider mb-3" style={{ color: "#9aa0b0" }}>Ваше завдання</p>
      <p className="font-bold text-base" style={{ color: "#1a2035" }}>Створення API для авторизації</p>
      </div>

      {/* Last Submit */}
      <div className="p-6 rounded-2xl spr"
      style={{
        background: "rgba(45,91,227,0.10)",
          border: "1.5px solid #2d5be3",
      }}
      >
      <p className="text-[10px] font-black uppercase tracking-wider mb-3" style={{ color: "#2d5be3" }}>Останній сабміт</p>
      <div className="flex items-center gap-2" style={{ color: "#2d5be3" }}>
      <FileText size={16} />
      <p className="text-sm font-bold italic">v2_final_build.zip</p>
      </div>
      </div>
      </div>

      {/* Action Section */}
      <div className="mt-8 flex flex-col sm:flex-row items-center justify-between gap-4 pt-8" style={{ borderTop: "1.5px solid rgba(0,0,0,0.07)" }}>
      <p className="text-sm" style={{ color: "#5a6278" }}>
      <span className="font-bold italic" style={{ color: "#9aa0b0" }}>Статус:</span> Файли перевіряються автоматичною системою...
      </p>
      <button className="spr" style={{
        background: "#2d5be3",
        color: "#fff",
        fontWeight: "800",
        fontSize: "14px",
        letterSpacing: ".06em",
        textTransform: "uppercase",
        border: "none",
        borderRadius: "999px",
        cursor: "pointer",
        padding: "12px 32px",
        display: "flex",
        alignItems: "center",
        gap: "8px",
      }}
      onMouseEnter={(e) => e.currentTarget.style.background = "#1e47cc"}
      onMouseLeave={(e) => e.currentTarget.style.background = "#2d5be3"}
      >
      <Upload size={18} /> Здати нову версію
      </button>
      </div>
      </section>

      </div>
      </main>
      </div>
  );
}

// --- NAV ITEM COMPONENT ---
function NavItem({ icon, label, active = false }: { icon: any, label: string, active?: boolean }) {
  return (
    <button
    className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-bold transition-all spr`}
    style={{
      background: active ? "#2d5be3" : "transparent",
      color: active ? "white" : "#5a6278",
    }}
    onMouseEnter={(e) => {
      if (!active) {
        e.currentTarget.style.background = "#ebebee";
        e.currentTarget.style.color = "#2d5be3";
      }
    }}
    onMouseLeave={(e) => {
      if (!active) {
        e.currentTarget.style.background = "transparent";
        e.currentTarget.style.color = "#5a6278";
      }
    }}
    >
    {icon} <span>{label}</span>
    </button>
  );
}

// --- FILTER BUTTON COMPONENT ---
function FilterButton({ label, active = false }: { label: string, active?: boolean }) {
  return (
    <button
    className={`px-4 py-2 rounded-full text-xs font-bold transition-all spr`}
    style={{
      background: active ? "#2d5be3" : "#ebebee",
      color: active ? "white" : "#5a6278",
      border: active ? "none" : "1.5px solid rgba(0,0,0,0.12)",
    }}
    >
    {label}
    </button>
  );
}

// --- TOURNAMENT ROW COMPONENT ---
function TournamentRow({ title, status, statusType, date, participation, isSpecialAction }: any) {
  const statusColors = {
    warning: { bg: "rgba(245,158,11,.12)", color: "#d97706" },
    info: { bg: "rgba(45,91,227,0.10)", color: "#2d5be3" },
    success: { bg: "rgba(34,197,94,.12)", color: "#16a34a" }
  };

  const colors = statusColors[statusType as keyof typeof statusColors] || statusColors.info;

  return (
    <tr className="group spr"
    style={{
      background: "transparent",
      transition: "background 200ms ease",
    }}
    onMouseEnter={(e) => e.currentTarget.style.background = "#ebebee"}
    onMouseLeave={(e) => e.currentTarget.style.background = "transparent"}
    >
    <td className="px-8 py-5 font-bold" style={{ color: "#1a2035" }}>{title}</td>
    <td className="px-8 py-5">
    <span className="text-[10px] font-black uppercase px-2.5 py-1.5 rounded border" style={{ background: colors.bg, color: colors.color, border: `1.5px solid ${colors.color}40` }}>
    {status}
    </span>
    </td>
    <td className="px-8 py-5 font-medium" style={{ color: "#5a6278" }}>{date}</td>
    <td className="px-8 py-5 font-medium" style={{ color: "#1a2035" }}>{participation}</td>
    <td className="px-8 py-5 text-right">
    {isSpecialAction ? (
      <button className="font-black text-[10px] uppercase tracking-tighter px-3 py-2 rounded-lg border spr transition-all"
      style={{
        color: "#2d5be3",
        border: "1.5px solid #2d5be3",
        background: "rgba(45,91,227,0.10)",
      }}
      onMouseEnter={(e) => {
        e.currentTarget.style.background = "#2d5be3";
        (e.currentTarget as any).style.color = "white";
      }}
      onMouseLeave={(e) => {
        e.currentTarget.style.background = "rgba(45,91,227,0.10)";
        (e.currentTarget as any).style.color = "#2d5be3";
      }}
      >
      Зареєструватись
      </button>
    ) : (
      <button className="p-2 rounded-lg spr"
      style={{
        color: "#9aa0b0",
        transition: "background 200ms ease, color 200ms ease",
      }}
      onMouseEnter={(e) => {
        e.currentTarget.style.background = "rgba(45,91,227,0.10)";
        e.currentTarget.style.color = "#2d5be3";
      }}
      onMouseLeave={(e) => {
        e.currentTarget.style.background = "transparent";
        e.currentTarget.style.color = "#9aa0b0";
      }}
      >
      <ExternalLink size={18} />
      </button>
    )}
    </td>
    </tr>
  );
}
