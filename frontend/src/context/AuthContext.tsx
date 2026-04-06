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
    login: (user: User, token: string) => void;
    logout: () => void;
    updateUser: (patch: Partial<User>) => void;
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
    if (!context) {
        throw new Error("useAuth must be used within an AuthProvider");
    }
    return context;
};

export function AuthProvider({ children }: { children: ReactNode }) {
    const [user, setUser] = useState<User | null>(null);
    const [token, setToken] = useState<string | null>(null);
    const [isLoading, setIsLoading] = useState(true);

    useEffect(() => {
        // Сразу проверяем localStorage
        const savedToken = localStorage.getItem("access_token");
        const savedUser = localStorage.getItem("user");

        console.log("AuthContext init - saved token:", savedToken ? "yes" : "no");
        console.log("AuthContext init - saved user:", savedUser ? "yes" : "no");

        if (savedToken && savedUser) {
            try {
                const parsedUser = JSON.parse(savedUser);
                console.log("Setting user from localStorage:", parsedUser.username);
                setToken(savedToken);
                setUser(parsedUser);
            } catch (e) {
                console.error("Auth error:", e);
                localStorage.removeItem("access_token");
                localStorage.removeItem("user");
            }
        }

        // Немедленно отмечаем, что загрузка завершена
        setIsLoading(false);
    }, []);

    const login = (userData: User, accessToken: string) => {
        console.log("AuthContext login:", userData.username, userData.role);
        setUser(userData);
        setToken(accessToken);
        localStorage.setItem("access_token", accessToken);
        localStorage.setItem("user", JSON.stringify(userData));
    };

    const logout = () => {
        console.log("AuthContext logout");
        localStorage.removeItem("access_token");
        localStorage.removeItem("user");
        document.cookie = "access_token=; path=/; max-age=0";
        setUser(null);
        setToken(null);
        window.location.href = "/";
    };

    const updateUser = (patch: Partial<User>) => {
        setUser((prev) => {
            if (!prev) return prev;
            const next = { ...prev, ...patch };
            localStorage.setItem("user", JSON.stringify(next));
            return next;
        });
    };

    return (
        <AuthContext.Provider value={{ user, token, isLoading, login, logout, updateUser }}>
        {children}
        </AuthContext.Provider>
    );
}
