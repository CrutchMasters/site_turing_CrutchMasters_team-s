"use client";

import { createContext, useContext, useEffect, useState, ReactNode, useRef, useCallback } from "react";
import { createBrowserClient } from "@supabase/ssr";

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

const supabaseClient = createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL ?? "",
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? ""
);

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

    const refreshRole = useCallback(async (u: User) => {
        try {
            const { data } = await supabaseClient.from("account")
            .select("id, username, login, email, role, status, avatar_url")
            .eq("id", u.id).single();
            if (!data) return;
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

    useEffect(() => {
        let cancelled = false;

        const init = async () => {
            const savedToken = localStorage.getItem("access_token");
            const savedUser  = localStorage.getItem("user");

            // Нет данных — гость
            if (!savedToken || !savedUser) {
                if (!cancelled) setIsLoading(false);
                return;
            }

            // Парсим пользователя
            let parsedUser: User;
            try {
                parsedUser = JSON.parse(savedUser);
            } catch {
                clearStorage();
                if (!cancelled) setIsLoading(false);
                return;
            }

            // Определяем активный токен:
            // — если живой, используем его
            // — если протух, пробуем рефреш
            // ВАЖНО: setUser вызывается только после того как токен подтверждён
            let activeToken: string;

            if (getTokenExpiry(savedToken) > Date.now()) {
                // Токен живой — всё ок
                activeToken = savedToken;
            } else {
                // Токен протух — пробуем тихо обновить
                const refreshed = await doRefresh();
                if (!refreshed) {
                    // Рефреш тоже не удался — чистим и считаем гостем
                    clearStorage();
                    if (!cancelled) {
                        setUser(null);
                        setToken(null);
                        setIsLoading(false);
                    }
                    return;
                }
                activeToken = refreshed;
            }

            // Токен подтверждён — теперь можно устанавливать пользователя
            if (!cancelled) {
                setToken(activeToken);
                setUser(parsedUser);
                scheduleRefresh(activeToken);
                setIsLoading(false);
            }

            // Фоново синхронизируем роль из БД
            refreshRole(parsedUser);
        };

        init().catch(() => {
            if (!cancelled) setIsLoading(false);
        });

            return () => {
                cancelled = true;
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
