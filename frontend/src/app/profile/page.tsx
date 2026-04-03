"use client";

import React, { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import {
  User, Mail, Shield, Users, History,
  CheckCircle, Clock, XCircle, Edit2, ChevronRight, UserCircle,
} from "lucide-react";
import { useTheme } from "@/hooks/useTheme";
import { useAuth } from "@/context/AuthContext";
import Sidebar from "@/components/Sidebar";
import MobileHeader from "@/components/MobileHeader";

const API_URL =
  typeof window !== "undefined" && window.location.hostname === "localhost"
    ? "http://localhost:8000"
    : "https://site-turing-crutchmasters-team-s.onrender.com";

export default function UserProfile() {
  const [isMobileSidebarOpen, setIsMobileSidebarOpen] = useState(false);
  const [backendMessage, setBackendMessage] = useState("waiting...");
  const { dark } = useTheme();
  const router = useRouter();
  const { user, isLoading } = useAuth();

  useEffect(() => {
    if (isLoading || !user) return;
    fetch(`${API_URL}/api/test`)
      .then(r => r.json())
      .then(d => setBackendMessage(d.message))
      .catch(() => setBackendMessage("Disconnected"));
  }, [isLoading, user]);

  if (isLoading) return (
    <div className="min-h-screen bg-(--bg) flex items-center justify-center">
      <div className="w-8 h-8 border-2 border-blue-600 border-t-transparent rounded-full animate-spin" />
    </div>
  );

  if (!user) {
    if (typeof window !== "undefined") router.push("/login");
    return null;
  }

  const avatarLetter = user.username?.charAt(0).toUpperCase() ?? "?";

  return (
    <div className="flex h-screen overflow-hidden bg-(--bg) text-(--t1) transition-colors duration-300">
      {/* Watermark */}
      <div className={`fixed inset-0 flex items-center justify-center pointer-events-none z-0 ${dark ? "opacity-10" : "opacity-5"}`}>
        <img src="/logo_background1.png" alt="" className={`w-[min(800px,90vw)] h-[min(800px,90vw)] object-contain blur-sm ${dark ? "invert" : ""}`} />
      </div>

      {isMobileSidebarOpen && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-40 lg:hidden" onClick={() => setIsMobileSidebarOpen(false)} />
      )}

      <div className={`fixed inset-y-0 left-0 z-50 lg:relative lg:translate-x-0 transition-transform duration-300 ease-in-out ${isMobileSidebarOpen ? "translate-x-0" : "-translate-x-full lg:translate-x-0"}`}>
        <Sidebar backendMessage={backendMessage} />
      </div>

      <main className="flex-1 flex flex-col min-w-0 overflow-hidden">
        <MobileHeader
          onOpenSidebar={() => setIsMobileSidebarOpen(true)}
          title="Профіль"
          icon={<UserCircle size={18} className="text-blue-600" />}
        />

        <div className="flex-1 overflow-y-auto p-4 sm:p-6 md:p-8 lg:p-12 relative z-10">
          <nav className="flex items-center gap-2 text-[10px] font-black mb-4 uppercase tracking-widest text-(--t2)">
            <button onClick={() => router.push("/")} className="hover:text-blue-600">Головна</button>
            <ChevronRight size={10} /><span className="text-(--t1)">Профіль</span>
          </nav>

          <h1 className="text-2xl sm:text-3xl font-black text-(--t1) uppercase tracking-tight mb-6 sm:mb-8">
            Профіль — <span className="text-blue-600">{user.username}</span>
          </h1>

          <div className="max-w-6xl space-y-6">
            <section className="bg-(--card) rounded-2xl sm:rounded-[2.5rem] shadow-sm border border-(--brd) p-6 sm:p-8 flex flex-col sm:flex-row items-center gap-6 sm:gap-8 relative overflow-hidden">
              <div className="absolute right-0 top-0 opacity-5 pointer-events-none text-(--t1) hidden md:block"><Shield size={240} /></div>
              <div className="relative flex-shrink-0">
                <div className="w-24 h-24 sm:w-28 sm:h-28 rounded-full bg-blue-600/10 flex items-center justify-center border-4 border-(--brd) shadow-md">
                  <span className="text-4xl font-black text-blue-600">{avatarLetter}</span>
                </div>
                <span className="absolute bottom-1 right-1 w-5 h-5 bg-green-500 border-4 border-(--card) rounded-full shadow-sm" />
              </div>
              <div className="flex-1 space-y-4 z-10 w-full">
                <div className="flex flex-col sm:flex-row justify-between items-center sm:items-start gap-4">
                  <div className="text-center sm:text-left">
                    <h2 className="text-lg font-black flex flex-wrap justify-center sm:justify-start items-center gap-2 uppercase tracking-tight">
                      1. Базова інформація
                      <span className="text-green-600 text-[9px] font-black uppercase bg-green-500/10 px-2.5 py-1 rounded-lg border border-green-500/20">Активний</span>
                    </h2>
                    <div className="mt-4 space-y-2.5 text-sm text-left">
                      <p className="flex items-center gap-3 font-medium"><User size={16} className="text-blue-600 flex-shrink-0" /><span className="text-(--t2)">Ім'я:</span> <span className="font-bold">{user.username}</span></p>
                      <p className="flex items-center gap-3 font-medium"><User size={16} className="text-blue-600 flex-shrink-0" /><span className="text-(--t2)">Логін:</span> <span className="font-bold">{user.login}</span></p>
                      <p className="flex items-center gap-3 font-medium"><Mail size={16} className="text-blue-600 flex-shrink-0" /><span className="text-(--t2)">Email:</span> <span className="font-bold break-all">{user.email}</span></p>
                      <p className="flex items-center gap-3 font-bold text-blue-600"><Shield size={16} className="flex-shrink-0" /><span>Роль:</span> <span className="uppercase tracking-wider">{user.role}</span></p>
                    </div>
                  </div>
                  <button className="w-full sm:w-auto bg-blue-600 text-white px-6 py-3 sm:py-4 rounded-2xl font-black text-xs uppercase tracking-widest hover:bg-blue-700 transition-all flex items-center justify-center gap-2 shadow-lg shadow-blue-600/20 active:scale-95">
                    <Edit2 size={14} /> Редагувати
                  </button>
                </div>
                <div className="pt-3 border-t border-(--brd) text-[9px] font-bold uppercase tracking-widest text-(--t2) text-center sm:text-left">ID: {user.id}</div>
              </div>
            </section>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              <section className="bg-(--card) rounded-2xl sm:rounded-[2.5rem] shadow-sm border border-(--brd) p-6 sm:p-8">
                <h2 className="text-lg font-black mb-6 flex items-center gap-2 uppercase tracking-tight text-(--t1)"><Users className="text-blue-600" /> 2a. Команда</h2>
                <div className="space-y-3">
                  {[{ name: "Антон Петров", role: "Team Lead" }, { name: "Марія Сидоренко", role: "Frontend" }, { name: "Олег Іванов", role: "UI/UX" }].map((m, i) => (
                    <div key={i} className="flex items-center justify-between p-3 rounded-2xl bg-(--bg)/30 border border-(--brd) hover:bg-(--bg)/50 transition-colors">
                      <div className="flex items-center gap-3 overflow-hidden">
                        <div className="w-8 h-8 rounded-full bg-blue-600/10 flex items-center justify-center font-bold text-blue-600 text-xs flex-shrink-0">{m.name.charAt(0)}</div>
                        <div className="overflow-hidden"><p className="font-bold text-sm truncate">{m.name}</p><p className="text-[10px] text-(--t2) font-bold uppercase tracking-tighter">{m.role}</p></div>
                      </div>
                      <button className="text-blue-600 font-black text-[9px] uppercase hover:underline ml-2 flex-shrink-0">Профіль</button>
                    </div>
                  ))}
                </div>
              </section>

              <section className="bg-(--card) rounded-2xl sm:rounded-[2.5rem] shadow-sm border border-(--brd) p-6 sm:p-8">
                <h2 className="text-lg font-black mb-6 flex items-center gap-2 uppercase tracking-tight text-(--t1)"><History className="text-blue-600" /> 2b. Сабміти</h2>
                <div className="space-y-3">
                  {[
                    { task: "Проєкт A - API", time: "21.03.2026", color: "text-green-600", Icon: CheckCircle },
                    { task: "Frontend Base",  time: "20.03.2026", color: "text-blue-600",  Icon: Clock },
                    { task: "Auth System",    time: "18.03.2026", color: "text-red-600",   Icon: XCircle },
                  ].map((s, i) => (
                    <div key={i} className="flex items-center justify-between p-4 rounded-2xl bg-(--bg)/50 border border-(--brd) hover:border-blue-600/20 transition-all">
                      <div className="flex items-center gap-3">
                        <s.Icon className={s.color} size={20} />
                        <div><p className="font-bold text-sm leading-none mb-1">{s.task}</p><p className="text-[9px] font-bold text-(--t2) uppercase tracking-wider">{s.time}</p></div>
                      </div>
                      <span className={`text-[8px] font-black uppercase px-2 py-1 rounded-md bg-(--card) border border-(--brd) ${s.color}`}>{i === 0 ? "success" : i === 1 ? "pending" : "failed"}</span>
                    </div>
                  ))}
                </div>
              </section>
            </div>
          </div>

          <footer className="mt-10 text-center text-[10px] font-black uppercase tracking-[0.2em] text-(--t2) opacity-50">
            * Профіль оновлено: {new Date().toLocaleTimeString()}
          </footer>
        </div>
      </main>
    </div>
  );
}
