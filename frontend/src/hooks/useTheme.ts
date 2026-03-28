"use client";

import { useEffect, useState } from "react";

export function useTheme() {
    // Читаем тему синхронно из localStorage чтобы не было мигания
    const [dark, setDark] = useState<boolean>(() => {
        if (typeof window === "undefined") return false;
        return localStorage.getItem("theme") === "dark";
    });

    // При первом рендере применяем класс к <html>
    useEffect(() => {
        const saved = localStorage.getItem("theme");
        const isDark = saved === "dark";
        setDark(isDark);
        applyTheme(isDark);
    }, []);

    const toggle = () => {
        const newDark = !dark;
        setDark(newDark);
        applyTheme(newDark);
        localStorage.setItem("theme", newDark ? "dark" : "light");
    };

    return { dark, toggle };
}

function applyTheme(isDark: boolean) {
    const root = document.documentElement;
    if (isDark) {
        root.classList.add("dark");
    } else {
        root.classList.remove("dark");
    }
}
