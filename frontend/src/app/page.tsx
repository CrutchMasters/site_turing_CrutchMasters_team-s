"use client";

import { useTheme } from "@/hooks/useTheme";
import Link from "next/link";
import { useEffect, useState, useRef } from "react";
import { useLanguage } from "@/context/LanguageContext";
import { useAuth } from "@/context/AuthContext";
import {
  LayoutDashboard, Trophy, Users, UserCircle,
  Settings, LogOut, ExternalLink, Upload,
  ChevronRight, Menu, Home,
} from "lucide-react";

const API_URL =
typeof window !== "undefined" && window.location.hostname === "localhost"
? "http://localhost:8000"
: "https://site-turing-crutchmasters-team-s.onrender.com";

export default function HomePage() {
  const { locale, setLocale, t } = useLanguage();
  const { dark, toggle } = useTheme();
  const { user, logout, isLoading } = useAuth();
  const [backendMessage, setBackendMessage] = useState("waiting...");
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [isUserMenuOpen, setIsUserMenuOpen] = useState(false);
  // ✅ mounted guard — prevents server/client mismatch for localStorage-dependent values
  const [mounted, setMounted] = useState(false);

  const revealRefs = useRef<(HTMLDivElement | null)[]>([]);
  const headerRef = useRef<HTMLDivElement>(null);
  const settingsRef = useRef<HTMLDivElement>(null);
  const userMenuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    setMounted(true);

    fetch(`${API_URL}/api/test`)
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
        if (userMenuRef.current && !userMenuRef.current.contains(event.target as Node)) {
          setIsUserMenuOpen(false);
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

  const sections = t.infoSections || [];
  const avatarLetter = user?.username?.charAt(0).toUpperCase() ?? "?";

  // ✅ After mount, use real dark value; before mount, assume light (matches SSR default)
  const isDark = mounted && dark;

  return (
    <div className="flex flex-col font-sans overflow-x-hidden min-h-screen bg-(--bg) text-(--t1)">

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
      {/* ✅ isDark instead of dark — safe after mount */}
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

      {/* HEADER */}
      <div className="fixed top-0 w-full flex justify-center z-50 p-2 sm:p-4">
      <header
      ref={headerRef}
      className="plasma-menu opacity-0 -translate-y-full w-full max-w-7xl bg-(--card)/70 backdrop-blur-xl py-2.5 px-4 sm:py-3 sm:px-8 flex justify-between items-center rounded-xl sm:rounded-2xl shadow-lg border border-(--brd)"
      >
      <div className="flex items-center gap-2 sm:gap-3 min-w-0">
      <img
      src="/logo_homepage.png"
      alt="Logo"
      width={24}
      height={24}
      className="flex-shrink-0"
      />
      <span className="text-sm sm:text-lg font-bold tracking-tight text-(--t1) uppercase truncate">
      CodeFuture
      </span>
      </div>

      <div className="flex items-center gap-2 sm:gap-4 flex-shrink-0">
      {/* ✅ mounted && user — SSR renders sign-in/up buttons, client swaps in user menu */}
      {mounted && user ? (
        <div className="relative" ref={userMenuRef}>
        <button
        onClick={() => setIsUserMenuOpen(!isUserMenuOpen)}
        className="flex items-center gap-2 sm:gap-3 px-2 sm:px-3 py-1.5 rounded-xl hover:bg-(--bg) transition-all border border-transparent hover:border-(--brd)"
        >
        <div className="w-8 h-8 rounded-full bg-blue-600 flex items-center justify-center text-white font-black text-sm">
        {avatarLetter}
        </div>
        <span className="text-sm font-bold text-(--t1) hidden sm:block max-w-[120px] truncate">
        {user.username}
        </span>
        <ChevronRight
        className={`w-3 h-3 text-(--t2) transition-transform rotate-90 ${
          isUserMenuOpen ? "rotate-[270deg]" : ""
        }`}
        />
        </button>

        {isUserMenuOpen && (
          <div className="absolute right-0 top-full mt-2 w-48 bg-(--card) border border-(--brd) rounded-2xl shadow-xl overflow-hidden z-50">
          <div className="px-4 py-3 border-b border-(--brd)">
          <p className="text-xs font-black text-(--t1) truncate">
          {user.username}
          </p>
          <p className="text-[10px] font-bold text-(--t2) uppercase tracking-wider">
          {user.role}
          </p>
          </div>
          <Link
          href="/dashboard"
          className="flex items-center gap-3 px-4 py-3 text-sm font-bold text-(--t2) hover:bg-(--bg) hover:text-blue-600 transition-colors"
          >
          <LayoutDashboard size={16} /> Dashboard
          </Link>
          <Link
          href="/profile"
          className="flex items-center gap-3 px-4 py-3 text-sm font-bold text-(--t2) hover:bg-(--bg) hover:text-blue-600 transition-colors"
          >
          <UserCircle size={16} />{" "}
          {locale === "en" ? "Profile" : locale === "ru" ? "Профиль" : "Профіль"}
          </Link>
          <button
          onClick={logout}
          className="w-full flex items-center gap-3 px-4 py-3 text-sm font-bold text-red-500 hover:bg-red-500/10 transition-colors border-t border-(--brd)"
          >
          <LogOut size={16} />{" "}
          {locale === "en" ? "Sign Out" : locale === "ru" ? "Выйти" : "Вийти"}
          </button>
          </div>
        )}
        </div>
      ) : (
        <>
        <Link
        href="/login"
        className="text-xs sm:text-sm font-semibold text-(--t2) hover:text-blue-600 transition px-2 sm:px-3 py-1"
        >
        {t.nav.signIn}
        </Link>
        <Link href="/register">
        <button className="px-3 py-1.5 sm:px-5 sm:py-2 text-xs sm:text-sm font-bold text-white bg-blue-600 rounded-lg sm:rounded-xl hover:bg-blue-700 transition-all active:scale-95">
        {t.nav.signUp}
        </button>
        </Link>
        </>
      )}
      </div>
      </header>
      </div>

      {/* HERO SECTION */}
      <main className="relative min-h-screen flex items-center justify-center px-4 pt-20 pb-10 sm:p-6 overflow-hidden">
      {/* ✅ isDark used here too */}
      <div
      className={`fixed inset-0 flex items-center justify-center pointer-events-none z-0 transition-opacity ${
        isDark ? "opacity-10" : "opacity-5"
      }`}
      >
      <img
      src="/logo_background1.png"
      alt="Watermark"
      className={`w-[min(800px,90vw)] h-[min(800px,90vw)] object-contain ${
        isDark ? "invert" : ""
      }`}
      />
      </div>

      <div className="max-w-7xl w-full z-10">
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 sm:gap-8 items-stretch">
      {/* Ecosystem Card */}
      <div
      ref={(el) => { revealRefs.current[0] = el; }}
      className="reveal-drop opacity-0 -translate-y-10 bg-(--card)/95 backdrop-blur-sm p-6 sm:p-10 rounded-2xl sm:rounded-[2.5rem] shadow-xl border border-(--brd) flex flex-col"
      >
      <div className="w-10 h-10 sm:w-12 sm:h-12 rounded-xl bg-gradient-to-br from-blue-500 to-blue-600 flex items-center justify-center text-white mb-4 sm:mb-6">
      <Trophy size={24} />
      </div>
      <h2 className="text-lg sm:text-2xl font-black mb-2 sm:mb-4 text-(--t1) uppercase tracking-tight">
      {t.hero.ecosystem}
      </h2>
      <p className="text-(--t2) leading-relaxed text-sm">
      {t.hero.ecosystemDesc}{" "}
      <span className="font-bold text-blue-600">{t.hero.organizers}</span>{" "}
      {locale === "en" ? "and" : "та"}{" "}
      <span className="font-bold text-blue-600">{t.hero.participants}</span>.
      </p>
      </div>

      {/* Center Card */}
      <div
      ref={(el) => { revealRefs.current[1] = el; }}
      className="reveal-fade opacity-0 flex flex-col items-center justify-center gap-6 sm:gap-10"
      >
      {/* ✅ mounted && user avoids href/label mismatch */}
      <Link href={mounted && user ? "/dashboard" : "/register"} className="w-full max-w-[260px]">
      <button className="bg-blue-600 text-white px-6 py-4 sm:px-8 sm:py-6 rounded-2xl sm:rounded-[2rem] text-lg sm:text-2xl font-black shadow-[0_20px_40px_rgba(37,99,235,0.3)] hover:bg-blue-700 hover:scale-105 transition-all w-full uppercase">
      {mounted && user
        ? locale === "en" ? "Dashboard" : "Кабінет"
        : t.hero.getStarted}
        </button>
        </Link>
        <button
        onClick={scrollToContent}
        className="flex flex-col items-center gap-2 text-(--t2) hover:text-blue-600 transition-colors"
        >
        <span className="text-[10px] font-black uppercase tracking-[0.3em]">
        {t.hero.learnMore}
        </span>
        <ChevronRight className="w-5 h-5 rotate-90 animate-arrow-small" />
        </button>
        </div>

        {/* Functionality Card */}
        <div
        ref={(el) => { revealRefs.current[2] = el; }}
        className="reveal-drop opacity-0 -translate-y-10 bg-(--card)/95 backdrop-blur-sm p-6 sm:p-10 rounded-2xl sm:rounded-[2.5rem] shadow-xl border border-(--brd) flex flex-col"
        >
        <div className="w-10 h-10 sm:w-12 sm:h-12 rounded-xl bg-gradient-to-br from-blue-500 to-blue-600 flex items-center justify-center text-white mb-4 sm:mb-6">
        <Home size={24} />
        </div>
        <h2 className="text-lg sm:text-2xl font-black mb-2 sm:mb-4 text-(--t1) uppercase tracking-tight">
        {t.hero.functionality}
        </h2>
        <p className="text-(--t2) leading-relaxed text-sm">
        {t.hero.funcDesc}
        </p>
        </div>
        </div>
        </div>
        </main>

        {/* INFO SECTIONS */}
        <section
        id="content-section"
        className="py-16 sm:py-24 px-4 sm:px-10 max-w-5xl mx-auto space-y-4 sm:space-y-8 w-full"
        >
        {sections.map((item: any, index: number) => (
          <div
          key={index}
          ref={(el) => { revealRefs.current[index + 3] = el; }}
          className="reveal-drop opacity-0 -translate-y-10 bg-(--card) p-6 sm:p-10 rounded-2xl sm:rounded-[2.5rem] shadow-sm border border-(--brd)"
          >
          <h2 className="text-base sm:text-xl font-black mb-2 sm:mb-3 text-(--t1) uppercase tracking-tight">
          {item.title}
          </h2>
          <p className="text-(--t2) text-sm sm:text-base leading-relaxed">
          {item.text}
          </p>
          </div>
        ))}
        </section>

        <footer className="py-8 sm:py-12 border-t border-(--brd) flex flex-col items-center gap-3 opacity-30 mt-auto">
        <span className="text-[10px] font-bold uppercase tracking-[0.3em] text-(--t2)">
        Powered by Crutch Masters
        </span>
        </footer>
        </div>
  );
}
