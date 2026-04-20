//site_turing_CrutchMasters_team-s/frontend/src/app/search/page.tsx
"use client";

import { supabase } from "@/lib/supabase";
import React, { useState, useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import { useTheme } from "@/hooks/useTheme";
import { useAuth } from "@/context/AuthContext";
import { useT } from "@/context/LanguageContext";
import { Search, ChevronRight, Loader, Shield } from "lucide-react";
import Sidebar from "@/components/Sidebar";
import MobileHeader from "@/components/MobileHeader";

export default function SearchPage() {
  const [isMobileSidebarOpen, setIsMobileSidebarOpen] = useState(false);
  const router = useRouter();
  const { dark } = useTheme();
  const { user, isLoading } = useAuth();
  const { t } = useT();

  const [searchQuery, setSearchQuery] = useState("");
  const [searchResults, setSearchResults] = useState<any[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [hasSearched, setHasSearched] = useState(false);
  const [selectedUserIdx, setSelectedUserIdx] = useState<number | null>(null);
  const searchInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    searchInputRef.current?.focus();
  }, []);

  useEffect(() => {
    if (!isLoading && !user) {
      router.push("/login");
    }
  }, [isLoading, user, router]);

  const handleSearch = async () => {
    if (!searchQuery.trim()) {
      setSearchResults([]);
      setHasSearched(false);
      return;
    }
    setIsSearching(true);
    setHasSearched(true);
    setSelectedUserIdx(null);
    try {
      const q = searchQuery.trim();
      const { data, error } = await supabase
      .from("account")
      .select("id, username, login, email, role, status, avatar_url")
      .or(`username.ilike.%${q}%,login.ilike.%${q}%,email.ilike.%${q}%`)
      .eq("status", "active")
      .limit(20);
      if (error) throw error;
      setSearchResults(data ?? []);
    } catch (e) {
      console.error(e);
      setSearchResults([]);
    } finally {
      setIsSearching(false);
    }
  };

  const roleBadge = (role: string) => {
    if (role === "superadmin") return "bg-red-500/10 text-red-500 border-red-500/20";
    if (role === "admin")      return "bg-orange-500/10 text-orange-500 border-orange-500/20";
    if (role === "jury")       return "bg-purple-500/10 text-purple-500 border-purple-500/20";
    return "bg-gray-500/10 text-gray-500 border-gray-500/20";
  };

  const resultsLabel = searchResults.length === 1 ? t.search.results_one : t.search.results_many;

  if (isLoading || !user) {
    return (
      <div className="min-h-screen bg-(--bg) flex items-center justify-center">
      <div className="w-8 h-8 border-2 border-blue-600 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div className="flex h-screen overflow-hidden bg-(--bg) text-(--t1) transition-colors duration-300">
    <style jsx global>{`
      @keyframes fadeUp { from{opacity:0;transform:translateY(20px)} to{opacity:1;transform:none} }
      .fuIn { animation: fadeUp 340ms cubic-bezier(.22,1,.36,1) both }
      `}</style>

      <div className={`fixed inset-0 flex items-center justify-center pointer-events-none z-0 ${dark ? "opacity-10" : "opacity-5"}`}>
      <img src="/logo_background1.png" alt="" className={`w-[min(800px,90vw)] h-[min(800px,90vw)] object-contain blur-sm ${dark ? "invert" : ""}`} />
      </div>

      {isMobileSidebarOpen && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-40 lg:hidden" onClick={() => setIsMobileSidebarOpen(false)} />
      )}

      <div className={`fixed inset-y-0 left-0 z-50 lg:relative lg:translate-x-0 transition-transform duration-300 ease-in-out ${isMobileSidebarOpen ? "translate-x-0" : "-translate-x-full lg:translate-x-0"}`}>
      <Sidebar />
      </div>

      <main className="flex-1 flex flex-col min-w-0 overflow-hidden">
      <MobileHeader
      onOpenSidebar={() => setIsMobileSidebarOpen(true)}
      title={t.search.title}
      icon={<Search size={18} className="text-blue-600" />}
      />

      <div className="flex-1 overflow-y-auto p-4 sm:p-6 md:p-8 lg:p-12 relative z-10">
      <nav className="flex items-center gap-2 text-[10px] font-black mb-6 uppercase tracking-widest text-(--t2)">
      <button onClick={() => router.push("/")} className="hover:text-blue-600">{t.nav.home}</button>
      <ChevronRight size={10} />
      <span className="text-(--t1)">{t.search.title}</span>
      </nav>

      <h1 className="text-2xl sm:text-3xl font-black text-(--t1) uppercase tracking-tight mb-8">
      {t.search.title}
      </h1>

      <div className="space-y-6">
      <div className="bg-(--card) rounded-2xl sm:rounded-[2.5rem] shadow-xl border border-(--brd) p-6 sm:p-8">
      <div className="flex flex-col sm:flex-row gap-3">
      <div className="relative flex-1">
      <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-(--t2) pointer-events-none w-5 h-5" />
      <input
      ref={searchInputRef}
      type="text"
      placeholder={t.search.placeholder}
      value={searchQuery}
      onChange={e => setSearchQuery(e.target.value)}
      onKeyDown={e => e.key === "Enter" && handleSearch()}
      className="w-full pl-12 pr-5 py-4 rounded-2xl border border-(--brd) bg-(--bg) text-(--t1) focus:ring-2 focus:ring-blue-500 focus:bg-(--card) outline-none text-sm transition-all"
      />
      </div>
      <button
      onClick={handleSearch}
      disabled={isSearching || !searchQuery.trim()}
      className={`px-6 sm:px-8 py-4 rounded-2xl font-black text-xs uppercase tracking-widest transition-all active:scale-95 flex items-center justify-center gap-2 min-w-fit ${
        isSearching || !searchQuery.trim()
        ? "bg-(--brd) text-(--t2) cursor-not-allowed"
        : "bg-blue-600 text-white hover:bg-blue-700 shadow-lg shadow-blue-600/20"
      }`}
      >
      {isSearching ? <Loader className="w-4 h-4 animate-spin" /> : <Search size={16} />}
      {isSearching ? t.search.searching : t.search.btn}
      </button>
      </div>
      <p className="mt-3 text-[10px] font-bold text-(--t2) uppercase tracking-widest">{t.search.hint}</p>
      </div>

      {hasSearched && (
        <div className="space-y-4">
        {isSearching ? (
          <div className="flex flex-col items-center justify-center py-12 gap-4">
          <Loader className="w-8 h-8 text-blue-600 animate-spin" />
          <p className="text-(--t2) font-bold text-sm">{t.search.searching}</p>
          </div>
        ) : searchResults.length === 0 ? (
          <div className="bg-(--card) rounded-2xl sm:rounded-[2.5rem] p-8 sm:p-12 border border-(--brd) text-center">
          <p className="text-lg font-black text-(--t1) mb-2">{t.search.notFound}</p>
          <p className="text-(--t2) text-sm">{t.search.notFoundHint}</p>
          </div>
        ) : (
          <>
          <div className="text-[10px] font-black uppercase tracking-widest text-(--t2) px-2">
          {t.search.found}: {searchResults.length} {resultsLabel}
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 items-start">
          {searchResults.map((person, idx) => (
            <div
            key={person.id || idx}
            onClick={() => setSelectedUserIdx(selectedUserIdx === idx ? null : idx)}
            className="fuIn bg-(--card) rounded-2xl sm:rounded-[2rem] p-5 sm:p-6 border border-(--brd) hover:border-blue-600/50 cursor-pointer transition-all hover:shadow-lg hover:shadow-blue-600/10 group"
            style={{ animationDelay: `${idx * 50}ms` }}
            >
            <div className="flex items-start gap-4">
            {/* ✅ Avatar with photo */}
            <div className="w-12 h-12 rounded-full bg-blue-600/10 border-2 border-(--brd) flex-shrink-0 overflow-hidden flex items-center justify-center font-black text-blue-600 text-lg">
            {person.avatar_url ? (
              <img src={person.avatar_url} alt={person.username} className="w-full h-full object-cover" />
            ) : (
              person.username?.charAt(0).toUpperCase() || person.login?.charAt(0).toUpperCase() || "?"
            )}
            </div>
            <div className="flex-1 min-w-0">
            <p className="font-black text-(--t1) truncate group-hover:text-blue-600 transition-colors">
            {person.username || t.common.na}
            </p>
            <p className="text-[10px] font-bold text-(--t2) uppercase tracking-wider mb-1">
            {t.search.loginLabel}: {person.login || t.common.na}
            </p>
            <p className="text-[9px] font-bold text-(--t2) uppercase tracking-wider mb-2 break-all">
            {t.search.idLabel}: {person.id || t.common.na}
            </p>
            <p className="text-[10px] text-(--t2) break-all">{person.email || ""}</p>
            </div>
            </div>
            {selectedUserIdx === idx && (
              <div className="mt-4 pt-4 border-t border-(--brd) space-y-2">
              <div className="flex items-center justify-between">
              <span className="text-[10px] font-bold text-(--t2) uppercase">{t.search.role}:</span>
              <span className={`text-[10px] font-black uppercase px-2 py-0.5 rounded-md border ${roleBadge(person.role)}`}>
              {person.role === "superadmin" && <Shield size={10} className="inline mr-1" />}
              {person.role || "user"}
              </span>
              </div>
              <button
              onClick={e => {
                e.stopPropagation();
                if (person.id === user?.id) {
                  router.push('/profile');
                } else {
                  router.push(`/user/${person.id}`);
                }
              }}
              className="w-full mt-3 bg-blue-600 text-white py-2 rounded-xl font-black text-[10px] uppercase tracking-wider hover:bg-blue-700 transition-all active:scale-95"
              >
              {t.search.viewProfile}
              </button>
              </div>
            )}
            </div>
          ))}
          </div>
          </>
        )}
        </div>
      )}

      {!hasSearched && (
        <div className="bg-(--card) rounded-2xl sm:rounded-[2.5rem] p-12 sm:p-16 border border-(--brd) text-center">
        <Search className="w-16 h-16 text-(--t2) mx-auto mb-4 opacity-50" />
        <p className="text-lg font-black text-(--t1) mb-2">{t.search.emptyTitle}</p>
        <p className="text-(--t2) text-sm max-w-md mx-auto">{t.search.emptyHint}</p>
        </div>
      )}
      </div>
      </div>
      </main>
      </div>
  );
}
