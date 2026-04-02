"use client";

import { supabase } from "@/lib/supabase"; // добавить в импорты вверху
import React, { useState, useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import { useTheme } from "@/hooks/useTheme";
import { useAuth } from "@/context/AuthContext";
import { useLanguage } from "@/context/LanguageContext";
import {
    Search, ArrowLeft, Menu, Home, LayoutDashboard,
    Trophy, Users, UserCircle, Settings, LogOut,
    ChevronRight, Loader
} from "lucide-react";

const API_URL =
typeof window !== "undefined" && window.location.hostname === "localhost"
? "http://localhost:8000"
: "https://site-turing-crutchmasters-team-s.onrender.com";

export default function SearchPage() {
    const [isSidebarOpen, setIsSidebarOpen] = useState(false);
    const router = useRouter();
    const { dark } = useTheme();
    const { user, logout, isLoading } = useAuth();
    const { t } = useLanguage();

    const [searchQuery, setSearchQuery] = useState("");
    const [searchResults, setSearchResults] = useState<any[]>([]);
    const [isSearching, setIsSearching] = useState(false);
    const [hasSearched, setHasSearched] = useState(false);
    const [selectedUser, setSelectedUser] = useState<any>(null);

    const searchInputRef = useRef<HTMLInputElement>(null);

    // Автофокус на поле поиска при загрузке
    useEffect(() => {
        if (searchInputRef.current) {
            searchInputRef.current.focus();
        }
    }, []);

    // Защита страницы (только для авторизованных)
    if (isLoading) {
        return (
            <div className="min-h-screen bg-(--bg) flex items-center justify-center">
            <div className="w-8 h-8 border-2 border-blue-600 border-t-transparent rounded-full animate-spin" />
            </div>
        );
    }

    if (!user) {
        if (typeof window !== "undefined") router.push("/login");
        return null;
    }

    const go = (path: string) => {
        setIsSidebarOpen(false);
        router.push(path);
    };

    const avatarLetter = user.username?.charAt(0).toUpperCase() ?? "?";

    // Поиск людей
    const handleSearch = async () => {
        if (!searchQuery.trim()) {
            setSearchResults([]);
            setHasSearched(false);
            return;
        }

        setIsSearching(true);
        setHasSearched(true);
        setSelectedUser(null);

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
        } catch (error) {
            console.error("Search error:", error);
            setSearchResults([]);
        } finally {
            setIsSearching(false);
        }
    };
    // При нажатии Enter выполняем поиск
    const handleKeyPress = (e: React.KeyboardEvent<HTMLInputElement>) => {
        if (e.key === "Enter") {
            handleSearch();
        }
    };

    return (
        <div className="flex min-h-screen overflow-x-hidden bg-(--bg) text-(--t1) transition-colors duration-300">
        <style jsx global>{`
            @keyframes fadeUp {
                from { opacity: 0; transform: translateY(20px); }
                to { opacity: 1; transform: translateY(0); }
            }
            .fuIn { animation: fadeUp 340ms cubic-bezier(0.22, 1, 0.36, 1) both; }
            `}</style>

            {/* Watermark */}
            <div
            className={`fixed inset-0 flex items-center justify-center pointer-events-none z-0 transition-opacity ${
                dark ? "opacity-10" : "opacity-5"
            }`}
            >
            <img
            src="/logo_background1.png"
            alt=""
            className={`w-[min(800px,90vw)] h-[min(800px,90vw)] object-contain blur-sm ${
                dark ? "invert" : ""
            }`}
            />
            </div>

            {isSidebarOpen && (
                <div
                className="fixed inset-0 bg-black/50 backdrop-blur-sm z-40 lg:hidden"
                onClick={() => setIsSidebarOpen(false)}
                />
            )}

            {/* SIDEBAR */}
            <aside
            className={`fixed inset-y-0 left-0 z-50 w-72 bg-(--card) border-r border-(--brd) flex flex-col transition-transform duration-300 ease-in-out lg:relative lg:translate-x-0 ${
                isSidebarOpen ? "translate-x-0" : "-translate-x-full"
            }`}
            >
            <button
            onClick={() => go("/profile")}
            className="p-6 flex items-center gap-3 w-full text-left hover:bg-(--bg) border-b border-(--brd) transition-colors"
            >
            <div className="w-10 h-10 rounded-full bg-blue-600 flex items-center justify-center text-white font-bold text-sm flex-shrink-0">
            {avatarLetter}
            </div>
            <div className="overflow-hidden">
            <p className="text-sm font-bold text-(--t1) truncate">{user.username}</p>
            <p className="text-[10px] uppercase tracking-wider font-bold text-(--t2)">
            {user.role}
            </p>
            </div>
            </button>

            <nav className="flex-1 p-4 space-y-1 overflow-y-auto">
            <button
            onClick={() => go("/")}
            className="w-full flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-bold transition-all text-(--t2) hover:bg-(--bg) hover:text-blue-600 mb-4 border border-(--brd) border-dashed"
            >
            <Home size={18} />
            <span>На головну</span>
            </button>
            <NavItem
            icon={<LayoutDashboard size={18} />}
            label="Dashboard"
            onClick={() => go("/main_page")}
            />
            <NavItem
            icon={<Search size={18} />}
            label="Пошук людей"
            active
            onClick={() => {}}
            />
            <NavItem
            icon={<Users size={18} />}
            label="Команди"
            onClick={() => {}}
            />
            <NavItem
            icon={<UserCircle size={18} />}
            label="Мій Профіль"
            onClick={() => go("/profile")}
            />
            <NavItem
            icon={<Settings size={18} />}
            label="Налаштування"
            onClick={() => {}}
            />
            </nav>

            <div className="p-4 border-t border-(--brd)">
            <button
            onClick={logout}
            className="flex items-center gap-3 px-4 py-2.5 w-full text-sm font-bold rounded-xl text-(--t2) hover:text-red-500 transition-colors"
            >
            <LogOut size={18} /> Вихід
            </button>
            </div>
            </aside>

            {/* MAIN */}
            <main className="flex-1 flex flex-col min-w-0">
            {/* Mobile header */}
            <header className="lg:hidden p-4 flex items-center justify-between bg-(--card) border-b border-(--brd) sticky top-0 z-30">
            <button
            onClick={() => setIsSidebarOpen(true)}
            className="p-2 rounded-xl bg-(--bg) border border-(--brd) text-(--t1) active:scale-95 transition-transform"
            >
            <Menu size={24} />
            </button>
            <div className="flex items-center gap-2">
            <Search size={18} className="text-blue-600" />
            <span className="font-black text-xs uppercase tracking-tighter">
            Пошук
            </span>
            </div>
            <button
            onClick={() => go("/profile")}
            className="active:scale-95 transition-transform"
            >
            <div className="w-10 h-10 rounded-full flex items-center justify-center text-white font-bold text-xs bg-blue-600 border-2 border-(--brd)">
            {avatarLetter}
            </div>
            </button>
            </header>

            <div className="p-4 sm:p-6 md:p-8 lg:p-12 overflow-y-auto flex-1">
            {/* Breadcrumb */}
            <nav className="flex items-center gap-2 text-[10px] font-black mb-6 uppercase tracking-widest text-(--t2)">
            <button onClick={() => router.push("/")} className="hover:text-blue-600">
            Головна
            </button>
            <ChevronRight size={10} />
            <span className="text-(--t1)">Пошук людей</span>
            </nav>

            <h1 className="text-2xl sm:text-3xl font-black text-(--t1) uppercase tracking-tight mb-8">
            Пошук людей
            </h1>

            <div className="max-w-4xl space-y-6">
            {/* Search Card */}
            <div className="bg-(--card) rounded-2xl sm:rounded-[2.5rem] shadow-xl border border-(--brd) p-6 sm:p-8">
            <div className="flex flex-col sm:flex-row gap-3">
            <div className="relative flex-1">
            <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-(--t2) pointer-events-none w-5 h-5" />
            <input
            ref={searchInputRef}
            type="text"
            placeholder="Шукати по логіну, імені або ID..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            onKeyPress={handleKeyPress}
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

            {/* Results */}
            {hasSearched && (
                <div className="space-y-4">
                {isSearching ? (
                    <div className="flex flex-col items-center justify-center py-12 gap-4">
                    <Loader className="w-8 h-8 text-blue-600 animate-spin" />
                    <p className="text-(--t2) font-bold text-sm">Пошук...</p>
                    </div>
                ) : searchResults.length === 0 ? (
                    <div className="bg-(--card) rounded-2xl sm:rounded-[2.5rem] p-8 sm:p-12 border border-(--brd) text-center">
                    <p className="text-lg font-black text-(--t1) mb-2">
                    Нічого не знайдено
                    </p>
                    <p className="text-(--t2) text-sm">
                    Спробуйте змінити параметри пошуку
                    </p>
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
                        {person.username?.charAt(0).toUpperCase() ||
                            person.login?.charAt(0).toUpperCase() ||
                            "?"}
                            </div>
                            <div className="flex-1 min-w-0">
                            <p className="font-black text-(--t1) truncate group-hover:text-blue-600 transition-colors">
                            {person.username || "N/A"}
                            </p>
                            <p className="text-[10px] font-bold text-(--t2) uppercase tracking-wider mb-1">
                            Логін: {person.login || "N/A"}
                            </p>
                            <p className="text-[9px] font-bold text-(--t2) uppercase tracking-wider mb-2 break-all">
                            ID: {person.id || "N/A"}
                            </p>
                            <p className="text-[10px] text-(--t2) break-all">
                            {person.email || ""}
                            </p>
                            </div>
                            </div>

                            {/* Expanded details */}
                            {selectedUser?.id === person.id && (
                                <div className="mt-4 pt-4 border-t border-(--brd) space-y-2">
                                <div className="flex items-center justify-between">
                                <span className="text-[10px] font-bold text-(--t2) uppercase">Роль:</span>
                                <span className="text-[10px] font-black text-blue-600 uppercase">
                                {person.role || "user"}
                                </span>
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
                <p className="text-lg font-black text-(--t1) mb-2">
                Почніть з пошуку
                </p>
                <p className="text-(--t2) text-sm max-w-md mx-auto">
                Введіть логін, ім'я користувача або ID у поле вище, щоб знайти людину в системі
                </p>
                </div>
            )}
            </div>
            </div>
            </main>
            </div>
    );
}

function NavItem({
    icon,
    label,
    active = false,
    onClick,
}: {
    icon: React.ReactNode;
    label: string;
    active?: boolean;
    onClick: () => void;
}) {
    return (
        <button
        onClick={onClick}
        className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-bold transition-all ${
            active
            ? "bg-blue-600 text-white shadow-lg shadow-blue-600/20"
            : "text-(--t2) hover:bg-(--bg) hover:text-blue-600"
        }`}
        >
        {icon}
        <span>{label}</span>
        </button>
    );
}
