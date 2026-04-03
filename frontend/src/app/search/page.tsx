"use client";

import { supabase } from "@/lib/supabase";
import React, { useState, useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import { useTheme } from "@/hooks/useTheme";
import { useAuth } from "@/context/AuthContext";
import { Search, ChevronRight, Loader } from "lucide-react";
import Sidebar from "@/components/Sidebar";
import MobileHeader from "@/components/MobileHeader";

export default function SearchPage() {
  const [isMobileSidebarOpen, setIsMobileSidebarOpen] = useState(false);
  const router = useRouter();
  const { dark } = useTheme();
  const { user, isLoading } = useAuth();

  const [searchQuery, setSearchQuery] = useState("");
  const [searchResults, setSearchResults] = useState<any[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [hasSearched, setHasSearched] = useState(false);
  const [selectedUser, setSelectedUser] = useState<any>(null);
  const searchInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => { searchInputRef.current?.focus(); }, []);

  if (isLoading) return (
    <div className="min-h-screen bg-(--bg) flex items-center justify-center">
      <div className="w-8 h-8 border-2 border-blue-600 border-t-transparent rounded-full animate-spin" />
    </div>
  );

  if (!user) {
    if (typeof window !== "undefined") router.push("/login");
    return null;
  }

  const handleSearch = async () => {
    if (!searchQuery.trim()) { setSearchResults([]); setHasSearched(false); return; }
    setIsSearching(true); setHasSearched(true); setSelectedUser(null);
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
          title="Пошук"
          icon={<Search size={18} className="text-blue-600" />}
        />

        <div className="flex-1 overflow-y-auto p-4 sm:p-6 md:p-8 lg:p-12 relative z-10">
          <nav className="flex items-center gap-2 text-[10px] font-black mb-6 uppercase tracking-widest text-(--t2)">
            <button onClick={() => router.push("/")} className="hover:text-blue-600">Головна</button>
            <ChevronRight size={10} /><span className="text-(--t1)">Пошук людей</span>
          </nav>
          <h1 className="text-2xl sm:text-3xl font-black text-(--t1) uppercase tracking-tight mb-8">Пошук людей</h1>

          <div className="max-w-4xl space-y-6">
            <div className="bg-(--card) rounded-2xl sm:rounded-[2.5rem] shadow-xl border border-(--brd) p-6 sm:p-8">
              <div className="flex flex-col sm:flex-row gap-3">
                <div className="relative flex-1">
                  <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-(--t2) pointer-events-none w-5 h-5" />
                  <input
                    ref={searchInputRef}
                    type="text"
                    placeholder="Шукати по логіну, імені або ID..."
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
                  {isSearching ? "..." : "Пошук"}
                </button>
              </div>
              <p className="mt-3 text-[10px] font-bold text-(--t2) uppercase tracking-widest">
                Введіть логін, ім'я користувача або ID, щоб знайти людину
              </p>
            </div>

            {hasSearched && (
              <div className="space-y-4">
                {isSearching ? (
                  <div className="flex flex-col items-center justify-center py-12 gap-4">
                    <Loader className="w-8 h-8 text-blue-600 animate-spin" />
                    <p className="text-(--t2) font-bold text-sm">Пошук...</p>
                  </div>
                ) : searchResults.length === 0 ? (
                  <div className="bg-(--card) rounded-2xl sm:rounded-[2.5rem] p-8 sm:p-12 border border-(--brd) text-center">
                    <p className="text-lg font-black text-(--t1) mb-2">Нічого не знайдено</p>
                    <p className="text-(--t2) text-sm">Спробуйте змінити параметри пошуку</p>
                  </div>
                ) : (
                  <>
                    <div className="text-[10px] font-black uppercase tracking-widest text-(--t2) px-2">
                      Знайдено: {searchResults.length} результат{searchResults.length > 1 ? "ів" : ""}
                    </div>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      {searchResults.map((person, idx) => (
                        <div
                          key={person.id || idx}
                          onClick={() => setSelectedUser(selectedUser?.id === person.id ? null : person)}
                          className="fuIn bg-(--card) rounded-2xl sm:rounded-[2rem] p-5 sm:p-6 border border-(--brd) hover:border-blue-600/50 cursor-pointer transition-all hover:shadow-lg hover:shadow-blue-600/10 group"
                          style={{ animationDelay: `${idx * 50}ms` }}
                        >
                          <div className="flex items-start gap-4">
                            <div className="w-12 h-12 rounded-full bg-blue-600/10 border-2 border-(--brd) flex items-center justify-center font-black text-blue-600 text-lg flex-shrink-0">
                              {person.username?.charAt(0).toUpperCase() || person.login?.charAt(0).toUpperCase() || "?"}
                            </div>
                            <div className="flex-1 min-w-0">
                              <p className="font-black text-(--t1) truncate group-hover:text-blue-600 transition-colors">{person.username || "N/A"}</p>
                              <p className="text-[10px] font-bold text-(--t2) uppercase tracking-wider mb-1">Логін: {person.login || "N/A"}</p>
                              <p className="text-[9px] font-bold text-(--t2) uppercase tracking-wider mb-2 break-all">ID: {person.id || "N/A"}</p>
                              <p className="text-[10px] text-(--t2) break-all">{person.email || ""}</p>
                            </div>
                          </div>
                          {selectedUser?.id === person.id && (
                            <div className="mt-4 pt-4 border-t border-(--brd) space-y-2">
                              <div className="flex items-center justify-between">
                                <span className="text-[10px] font-bold text-(--t2) uppercase">Роль:</span>
                                <span className="text-[10px] font-black text-blue-600 uppercase">{person.role || "user"}</span>
                              </div>
                              <button className="w-full mt-3 bg-blue-600 text-white py-2 rounded-xl font-black text-[10px] uppercase tracking-wider hover:bg-blue-700 transition-all active:scale-95">
                                Переглянути профіль
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
                <p className="text-lg font-black text-(--t1) mb-2">Почніть з пошуку</p>
                <p className="text-(--t2) text-sm max-w-md mx-auto">Введіть логін, ім'я користувача або ID у поле вище, щоб знайти людину в системі</p>
              </div>
            )}
          </div>
        </div>
      </main>
    </div>
  );
}
