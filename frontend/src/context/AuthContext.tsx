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
    updateUser: (user: User) => void;
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

export function AuthProvider({ children }: { children: ReactNode }) {
    const [user, setUser]           = useState<User | null>(null);
    const [token, setToken]         = useState<string | null>(null);
    const [isLoading, setIsLoading] = useState(true);
    const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

    const clearTimer = () => {
        if (timerRef.current) {
            clearTimeout(timerRef.current);
            timerRef.current = null;
        }
    };

    const doRefresh = useCallback(async (): Promise<string | null> => {
        try {
            const saved = localStorage.getItem("refresh_token");
            if (!saved) return null;

            const { data, error } = await supabaseClient.auth.refreshSession({
                refresh_token: saved,
            });

            if (error || !data?.session) {
                console.warn("Refresh failed:", error?.message);
                return null;
            }

            const { access_token, refresh_token } = data.session;
            localStorage.setItem("access_token", access_token);
            localStorage.setItem("refresh_token", refresh_token);
            document.cookie = `access_token=${access_token}; path=/; max-age=604800`;
            setToken(access_token);
            console.log("✅ Token refreshed");
            return access_token;
        } catch (e) {
            console.warn("doRefresh exception:", e);
            return null;
        }
    }, []);

    const scheduleRefresh = useCallback((accessToken: string) => {
        clearTimer();
        const expiry = getTokenExpiry(accessToken);
        const delay  = expiry - Date.now() - 5 * 60 * 1000;

        if (delay <= 0) {
            doRefresh().then(t => { if (t) scheduleRefresh(t); });
            return;
        }

        console.log(`🕐 Token refresh in ${Math.round(delay / 60000)} min`);
        timerRef.current = setTimeout(() => {
            doRefresh().then(t => { if (t) scheduleRefresh(t); });
        }, delay);
    }, [doRefresh]);

    const refreshRole = useCallback(async (u: User) => {
        try {
            const { data } = await supabaseClient
                .from("account")
                .select("id, username, login, email, role, status, avatar_url")
                .eq("id", u.id)
                .single();

            if (!data) return;

            const fresh: User = {
                id:         data.id,
                username:   data.username,
                login:      data.login,
                email:      data.email,
                role:       data.role,
                status:     data.status,
                avatar_url: data.avatar_url,
            };

            if (JSON.stringify(fresh) !== JSON.stringify(u)) {
                console.log(`🔄 Role: ${u.role} → ${fresh.role}`);
                setUser(fresh);
                localStorage.setItem("user", JSON.stringify(fresh));
            }
        } catch (e) {
            console.warn("refreshRole failed:", e);
        }
    }, []);

    useEffect(() => {
        let cancelled = false;

        const init = async () => {
            const savedToken = localStorage.getItem("access_token");
            const savedUser  = localStorage.getItem("user");

            if (!savedToken || !savedUser) {
                if (!cancelled) setIsLoading(false);
                return;
            }

            let parsedUser: User;
            try {
                parsedUser = JSON.parse(savedUser);
            } catch {
                localStorage.removeItem("access_token");
                localStorage.removeItem("user");
                localStorage.removeItem("refresh_token");
                if (!cancelled) setIsLoading(false);
                return;
            }

            // Сразу показываем пользователя без мигания
            if (!cancelled) {
                setToken(savedToken);
                setUser(parsedUser);
            }

            // Проверяем токен
            let activeToken = savedToken;
            if (getTokenExpiry(savedToken) < Date.now()) {
                console.log("⚠️ Token expired, refreshing...");
                const refreshed = await doRefresh();
                if (!refreshed) {
                    localStorage.removeItem("access_token");
                    localStorage.removeItem("user");
                    localStorage.removeItem("refresh_token");
                    if (!cancelled) {
                        setUser(null);
                        setToken(null);
                        setIsLoading(false);
                    }
                    return;
                }
                activeToken = refreshed;
            }

            if (!cancelled) {
                scheduleRefresh(activeToken);
                setIsLoading(false);
            }

            // Фоново обновляем роль
            refreshRole(parsedUser);
        };

        init().catch(e => {
            console.error("AuthProvider init error:", e);
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
        if (refreshToken) {
            localStorage.setItem("refresh_token", refreshToken);
        }
        scheduleRefresh(accessToken);
    }, [scheduleRefresh]);

    const logout = useCallback(() => {
        clearTimer();
        localStorage.removeItem("access_token");
        localStorage.removeItem("user");
        localStorage.removeItem("refresh_token");
        document.cookie = "access_token=; path=/; max-age=0";
        setUser(null);
        setToken(null);
        window.location.href = "/";
    }, []);

    const updateUser = useCallback((userData: User) => {
        setUser(userData);
        localStorage.setItem("user", JSON.stringify(userData));
    }, []);

    return (
        <AuthContext.Provider value={{ user, token, isLoading, login, logout, updateUser }}>
            {children}
        </AuthContext.Provider>
    );
}
