"use client";

import Image from "next/image";
import Link from "next/link";
import { useEffect, useState, useRef } from "react";
import { useLanguage } from "@/context/LanguageContext";

export default function Home() {
  const { locale, setLocale, t } = useLanguage();
  const [backendMessage, setBackendMessage] = useState("waiting...");
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const revealRefs = useRef<(HTMLDivElement | null)[]>([]);
  const headerRef = useRef<HTMLDivElement>(null);
  const settingsRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const API_URL = "http://localhost:8000/api/test";
    fetch(API_URL)
    .then((res) => res.json())
    .then((data) => setBackendMessage(data.message))
    .catch(() => setBackendMessage("Disconnected"));

    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            entry.target.classList.add("opacity-100", "translate-y-0");
            entry.target.classList.remove("opacity-0", "-translate-y-10");
          }
        });
      },
      { threshold: 0.1 }
    );

    revealRefs.current.forEach((ref) => {
      if (ref) observer.observe(ref);
    });

      if (headerRef.current) {
        setTimeout(() => {
          headerRef.current?.classList.add("opacity-100", "translate-y-0");
          headerRef.current?.classList.remove("opacity-0", "-translate-y-full");
        }, 100);
      }

      const handleClickOutside = (event: MouseEvent) => {
        if (settingsRef.current && !settingsRef.current.contains(event.target as Node)) {
          setIsSettingsOpen(false);
        }
      };
      document.addEventListener("mousedown", handleClickOutside);
      return () => {
        observer.disconnect();
        document.removeEventListener("mousedown", handleClickOutside);
      };
  }, []);

  const scrollToContent = () => {
    const element = document.getElementById("content-section");
    element?.scrollIntoView({ behavior: "smooth" });
  };

  // Тексты для секции преимуществ теперь тоже можно вынести в translations.ts
  // Но для начала используем структуру из контекста
  const sections = t.infoSections || [];

  return (
    <div className="min-h-screen bg-[#f3f4f6] flex flex-col font-sans text-slate-900 overflow-x-hidden">

    <style jsx global>{`
      @keyframes custom-bounce {
        0%, 100% { transform: translateY(0); }
        50% { transform: translateY(6px); }
      }
      .animate-arrow-small {
        animation: custom-bounce 2s infinite ease-in-out;
      }
      .reveal-drop {
        transition: all 0.8s cubic-bezier(0.22, 1, 0.36, 1);
      }
      .reveal-fade {
        transition: opacity 1.5s ease-in-out;
      }
      .plasma-menu {
        transition: transform 0.8s cubic-bezier(0.34, 1.56, 0.64, 1), opacity 0.6s ease-out;
      }
      `}</style>

      {/* --- КНОПКА НАСТРОЕК (KDE STYLE) --- */}
      <div className="fixed bottom-6 right-6 z-[60]" ref={settingsRef}>
      <div className={`absolute bottom-16 right-0 w-64 bg-white/80 backdrop-blur-2xl rounded-3xl shadow-2xl border border-white/50 p-5 transition-all duration-300 origin-bottom-right ${isSettingsOpen ? 'opacity-100 scale-100 translate-y-0' : 'opacity-0 scale-95 translate-y-4 pointer-events-none'}`}>
      <h3 className="text-xs font-black uppercase tracking-widest text-gray-400 mb-4 px-1">{t.settings.title}</h3>
      <div className="space-y-4">
      <div className="flex flex-col gap-2">
      <span className="text-sm font-bold text-gray-700">{t.settings.lang}</span>
      <div className="flex bg-gray-200/50 p-1 rounded-xl gap-1">
      {['en', 'ru', 'ua'].map((lang) => (
        <button
        key={lang}
        onClick={() => setLocale(lang as any)}
        className={`flex-1 py-1 text-[10px] font-black rounded-lg transition-all ${
          locale === lang ? 'bg-white shadow-sm text-blue-600' : 'text-gray-500 hover:text-blue-400'
        }`}
        >
        {lang.toUpperCase()}
        </button>
      ))}
      </div>
      </div>
      <div className="pt-4 border-t border-gray-100">
      <span className="text-[10px] font-black text-gray-400 uppercase tracking-tighter block mb-1">
      {t.settings.status}: {backendMessage}
      </span>
      </div>
      </div>
      </div>
      <button
      onClick={() => setIsSettingsOpen(!isSettingsOpen)}
      className={`p-4 rounded-2xl bg-white shadow-xl border border-gray-100 transition-all hover:scale-110 ${isSettingsOpen ? 'rotate-90 text-blue-600' : 'text-gray-500'}`}
      >
      <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" /><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" /></svg>
      </button>
      </div>

      {/* --- ПЛАВАЮЩИЙ ХЕДЕР --- */}
      <div className="fixed top-0 w-full flex justify-center z-50 p-4">
      <header ref={headerRef} className="plasma-menu opacity-0 -translate-y-full w-full max-w-7xl bg-white/70 backdrop-blur-xl py-3 px-8 flex justify-between items-center rounded-2xl shadow-[0_8px_32px_rgba(0,0,0,0.1)] border border-white/40">
      <div className="flex items-center gap-3">
      <Image src="/logo_homepage.svg" alt="Logo" width={28} height={28} priority />
      <span className="text-lg font-bold tracking-tight text-gray-800 uppercase">CodeFuture</span>
      </div>
      <div className="flex items-center gap-4">
      <Link href="/login" className="text-sm font-semibold text-gray-500 hover:text-blue-600 transition px-3 py-1">{t.nav.signIn}</Link>
      <Link href="/register">
      <button className="px-5 py-2 text-sm font-bold text-white bg-blue-600 rounded-xl hover:bg-blue-700 transition-all active:scale-95">{t.nav.signUp}</button>
      </Link>
      </div>
      </header>
      </div>

      {/* --- HERO СЕКЦИЯ --- */}
      <main className="relative min-h-screen flex items-center justify-center p-6 pt-24 overflow-hidden">
      <div className="absolute inset-0 flex items-center justify-center opacity-5 pointer-events-none">
      <img src="/logo_backround1.svg" alt="Watermark" className="w-[800px] h-[800px] object-contain" />
      </div>

      <div className="max-w-7xl w-full grid grid-cols-1 md:grid-cols-3 gap-8 items-stretch z-10">

      <div ref={(el) => { revealRefs.current[0] = el; }} className="reveal-drop opacity-0 -translate-y-10 bg-white/95 backdrop-blur-sm p-10 rounded-[2.5rem] shadow-xl border border-gray-100 flex flex-col">
      <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-blue-500 to-blue-600 flex items-center justify-center text-white mb-6">
      <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M21 12a9 9 0 01-9 9m9-9a9 9 0 00-9-9m9 9H3m9 9a9 9 0 01-9-9m9 9c1.657 0 3-4.03 3-9s-1.343-9-3-9m0 18c-1.657 0-3-4.03-3-9s1.343-9 3-9m-9 9a9 9 0 019-9" /></svg>
      </div>
      <h2 className="text-2xl font-black mb-4 text-gray-900 uppercase tracking-tight">{t.hero.ecosystem}</h2>
      <p className="text-gray-600 leading-relaxed text-sm mb-6">{t.hero.ecosystemDesc} <span className="font-bold text-blue-600">{t.hero.organizers}</span> {locale === 'en' ? 'and' : locale === 'ru' ? 'и' : 'та'} <span className="font-bold text-blue-600">{t.hero.participants}</span>.</p>
      </div>

      <div ref={(el) => { revealRefs.current[1] = el; }} className="reveal-fade opacity-0 flex flex-col items-center justify-center gap-10">
      <Link href="/register" className="w-full max-w-[260px]">
      <button className="bg-blue-600 text-white px-8 py-6 rounded-[2rem] text-2xl font-black shadow-[0_20px_40px_rgba(37,99,235,0.3)] hover:bg-blue-700 hover:scale-105 transition-all w-full uppercase tracking-tighter">
      {t.hero.getStarted}
      </button>
      </Link>

      <button onClick={scrollToContent} className="flex flex-col items-center gap-2 text-zinc-400 hover:text-blue-600 transition-colors group">
      <span className="text-[10px] font-black uppercase tracking-[0.3em]">{t.hero.learnMore}</span>
      <svg className="w-5 h-5 animate-arrow-small" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M19 13l-7 7-7-7m14-8l-7 7-7-7" />
      </svg>
      </button>
      </div>

      <div ref={(el) => { revealRefs.current[2] = el; }} className="reveal-drop opacity-0 -translate-y-10 bg-white/95 backdrop-blur-sm p-10 rounded-[2.5rem] shadow-xl border border-gray-100 flex flex-col">
      <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-blue-500 to-blue-600 flex items-center justify-center text-white mb-6">
      <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M13 10V3L4 14h7v7l9-11h-7z" /></svg>
      </div>
      <h2 className="text-2xl font-black mb-4 text-gray-900 uppercase tracking-tight">{t.hero.functionality}</h2>
      <p className="text-gray-600 leading-relaxed text-sm mb-6">{t.hero.funcDesc}</p>
      </div>
      </div>
      </main>

      {/* --- CONTENT СЕКЦИЯ --- */}
      <section id="content-section" className="py-24 px-10 max-w-5xl mx-auto space-y-8">
      {/* Если ты добавишь секции в translations.ts под ключом infoSections, они будут здесь */}
      {sections.map((item: any, index: number) => (
        <div key={index} ref={(el) => { revealRefs.current[index + 3] = el; }} className="reveal-drop opacity-0 -translate-y-10 bg-white p-10 rounded-[2.5rem] shadow-sm border border-gray-100">
        <h2 className="text-xl font-black mb-3 text-gray-800 uppercase tracking-tight">{item.title}</h2>
        <p className="text-gray-600 text-base leading-relaxed">{item.text}</p>
        </div>
      ))}
      </section>

      <footer className="py-12 border-t border-gray-100 flex flex-col items-center gap-3 opacity-30 mt-auto">
      <span className="text-[10px] font-bold uppercase tracking-[0.3em] text-gray-400">Powered by Crutch Masters</span>
      </footer>
      </div>
  );
}
