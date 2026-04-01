"use client";

import { useContext } from "react";
import { AuthContext } from "@/context/AuthContext"; // Перевірте шлях до файлу контексту

/**
 * Хук для використання контексту авторизації
 */
export const useAuth = () => {
    const context = useContext(AuthContext);

    if (!context) {
        throw new Error("useAuth must be used within an AuthProvider");
    }

    return context;
};
