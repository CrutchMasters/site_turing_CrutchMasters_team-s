"use client";

// ДОДАНО: useContext у список імпорту
import { createContext, useContext, useEffect, useState, ReactNode } from "react";

export interface User {
    id: string;
    username: string;
    login: string;
    email: string;
    role: "user" | "admin" | "jury" | "superadmin";
}

export interface AuthContextType {
    user: User | null;
    token: string | null;
    isLoading: boolean;
    logout: () => void;
}

export const AuthContext = createContext<AuthContextType>({
    user: null,
    token: null,
    isLoading: true,
    logout: () => {}
});

export const useAuth = () => {
    const context = useContext(AuthContext); // Тепер useContext визначено
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
        const savedToken = localStorage.getItem("access_token");
        const savedUser = localStorage.getItem("user");
        if (savedToken && savedUser) {
            try {
                setToken(savedToken);
                setUser(JSON.parse(savedUser));
            } catch (e) {
                console.error("Error parsing user from localStorage", e);
            }
        }
        setIsLoading(false);
    }, []);

    const logout = () => {
        localStorage.removeItem("access_token");
        localStorage.removeItem("user");
        document.cookie = "access_token=; path=/; max-age=0";
        setUser(null);
        setToken(null);
        window.location.href = "/";
    };

    return (
        <AuthContext.Provider value={{ user, token, isLoading, logout }}>
        {children}
        </AuthContext.Provider>
    );
}
