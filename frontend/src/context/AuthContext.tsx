"use client";

import { createContext, useContext, useEffect, useState, ReactNode, useRef, useCallback } from "react";
import { supabase as supabaseClient } from "@/lib/supabase";

export interface User {
    id: string;
    username: string;
    login: string;
    email: string;
    role: "user" | "admin" | "jury" | "superadmin";
    status?: string;
    avatar_url?: string;
}

export interface AuthContextType {
    user: User | null;
    token: string | null;
    isLoading: boolean;
    login: (user: User, token: string, refreshToken?: string) => void;
    logout: () => void;
    updateUser: (partial: Partial<User>) => void;
}

export const AuthContext = createContext<AuthContextType>({
    user: null,
    token: null,
    isLoading: true,
    login: () => {},
                                                          logout: () => {},
                                                          updateUser: () => {},
});

export const useAuth = () => {
    const context = useContext(AuthContext);
    if (!context) throw new Error("useAuth must be used within an AuthProvider");
    return context;
};

function getTokenExpiry(token: string): number {
    try {
        const payload = JSON.parse(atob(token.split(".")[1]));
        return (payload.exp ?? 0) * 1000;
    } catch {
        return 0;
    }
}

function clearStorage() {
    localStorage.removeItem("access_token");
    localStorage.removeItem("user");
    localStorage.removeItem("refresh_token");
    document.cookie = "access_token=; path=/; max-age=0";
}

export function AuthProvider({ children }: { children: ReactNode }) {
    const [user, setUser]           = useState<User | null>(null);
    const [token, setToken]         = useState<string | null>(null);
    const [isLoading, setIsLoading] = useState(true);
    const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

    const clearTimer = () => {
        if (timerRef.current) { clearTimeout(timerRef.current); timerRef.current = null; }
    };

    const doRefresh = useCallback(async (): Promise<string | null> => {
        try {
            const saved = localStorage.getItem("refresh_token");
            if (!saved) return null;
            const { data, error } = await supabaseClient.auth.refreshSession({ refresh_token: saved });
            if (error || !data?.session) return null;
            const { access_token, refresh_token } = data.session;
            localStorage.setItem("access_token", access_token);
            localStorage.setItem("refresh_token", refresh_token);
            document.cookie = `access_token=${access_token}; path=/; max-age=604800`;
            setToken(access_token);
            return access_token;
        } catch { return null; }
    }, []);

    const scheduleRefresh = useCallback((accessToken: string) => {
        clearTimer();
        const delay = getTokenExpiry(accessToken) - Date.now() - 5 * 60 * 1000;
        if (delay <= 0) { doRefresh().then(t => { if (t) scheduleRefresh(t); }); return; }
        timerRef.current = setTimeout(() => { doRefresh().then(t => { if (t) scheduleRefresh(t); }); }, delay);
    }, [doRefresh]);

    // БАГ ФИКС: добавили параметр cancelled чтобы refreshRole не обновлял
    // state после размонтирования компонента (race condition).
    const refreshRole = useCallback(async (u: User, cancelled: { current: boolean }) => {
        try {
            const { data } = await supabaseClient.from("account")
            .select("id, username, login, email, role, status, avatar_url")
            .eq("id", u.id)
            .single();

            // БАГ ФИКС: проверяем cancelled перед setState.
            // Раньше refreshRole мог записать данные уже после logout/размонтирования.
            if (!data || cancelled.current) return;

            const fresh: User = {
                id: data.id,
                username: data.username,
                login: data.login,
                email: data.email,
                role: data.role,
                status: data.status,
                avatar_url: data.avatar_url,
            };
            if (JSON.stringify(fresh) !== JSON.stringify(u)) {
                setUser(fresh);
                localStorage.setItem("user", JSON.stringify(fresh));
            }
        } catch { /* silent */ }
    }, []);

    // Sync token state when supabase.ts performs a silent refresh
    useEffect(() => {
        const handleTokenRefreshed = (e: Event) => {
            const { access_token } = (e as CustomEvent<{ access_token: string }>).detail;
            setToken(access_token);
            scheduleRefresh(access_token);
        };
        window.addEventListener("token:refreshed", handleTokenRefreshed);
        return () => window.removeEventListener("token:refreshed", handleTokenRefreshed);
    }, [scheduleRefresh]);

    useEffect(() => {
        // БАГ ФИКС: используем объект вместо примитива, чтобы передавать
        // cancelled по ссылке в refreshRole (избегаем stale closure).
        const cancelledRef = { current: false };

        const init = async () => {
            // БАГ ФИКС: весь init обёрнут в try/finally — isLoading
            // гарантированно станет false даже при неожиданных ошибках.
            try {
                const savedToken = localStorage.getItem("access_token");
                const savedUser  = localStorage.getItem("user");

                if (!savedToken || !savedUser) {
                    return; // finally → setIsLoading(false)
                }

                let parsedUser: User;
                try {
                    parsedUser = JSON.parse(savedUser);
                } catch {
                    clearStorage();
                    return; // finally → setIsLoading(false)
                }

                let activeToken: string;

                if (getTokenExpiry(savedToken) > Date.now()) {
                    activeToken = savedToken;
                } else {
                    const refreshed = await doRefresh();
                    if (!refreshed) {
                        clearStorage();
                        if (!cancelledRef.current) {
                            setUser(null);
                            setToken(null);
                        }
                        return; // finally → setIsLoading(false)
                    }
                    activeToken = refreshed;
                }

                if (!cancelledRef.current) {
                    setToken(activeToken);
                    setUser(parsedUser);
                    scheduleRefresh(activeToken);
                }

                // refreshRole вызываем после setIsLoading(false) (в finally),
                // передаём cancelledRef чтобы не писать в state после размонтирования.
                // Специально не await — не блокируем загрузку страницы.
                refreshRole(parsedUser, cancelledRef);

            } finally {
                // БАГ ФИКС: isLoading становится false ВСЕГДА — даже если
                // произошла любая неожиданная ошибка внутри init.
                if (!cancelledRef.current) {
                    setIsLoading(false);
                }
            }
        };

        init().catch(() => {
            if (!cancelledRef.current) setIsLoading(false);
        });

            return () => {
                cancelledRef.current = true;
                clearTimer();
            };
    }, [doRefresh, scheduleRefresh, refreshRole]);

    const login = useCallback((userData: User, accessToken: string, refreshToken?: string) => {
        setUser(userData);
        setToken(accessToken);
        localStorage.setItem("access_token", accessToken);
        localStorage.setItem("user", JSON.stringify(userData));
        document.cookie = `access_token=${accessToken}; path=/; max-age=604800`;
        if (refreshToken) localStorage.setItem("refresh_token", refreshToken);
        scheduleRefresh(accessToken);
    }, [scheduleRefresh]);

    const logout = useCallback(() => {
        clearTimer();
        clearStorage();
        setUser(null);
        setToken(null);
        window.location.href = "/";
    }, []);

    const updateUser = useCallback((partial: Partial<User>) => {
        setUser(prev => {
            if (!prev) return prev;
            const updated = { ...prev, ...partial };
            localStorage.setItem("user", JSON.stringify(updated));
            return updated;
        });
    }, []);

    return (
        <AuthContext.Provider value={{ user, token, isLoading, login, logout, updateUser }}>
        {children}
        </AuthContext.Provider>
    );
}
