"use client";

import { useEffect, useState } from "react";

export function useTheme() {
    // Ініціалізуємо стан значенням false (світла тема за замовчуванням)
    const [dark, setDark] = useState<boolean>(false);

    useEffect(() => {
        // Перевіряємо збережену тему в localStorage при завантаженні
        const savedTheme = localStorage.getItem("theme");
        const isDark = savedTheme === "dark";

        setDark(isDark);

        if (isDark) {
            document.documentElement.classList.add("dark");
        } else {
            document.documentElement.classList.remove("dark");
        }
    }, []);

    const toggle = () => {
        const newDark = !dark;
        setDark(newDark);

        if (newDark) {
            document.documentElement.classList.add("dark");
            localStorage.setItem("theme", "dark");
        } else {
            document.documentElement.classList.remove("dark");
            localStorage.setItem("theme", "light");
        }
    };

    return { dark, toggle };
}
