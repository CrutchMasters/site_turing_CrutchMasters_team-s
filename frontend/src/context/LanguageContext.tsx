"use client";

import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { translations, Locale } from '@/lib/translations';

// Типизация контекста для автодополнения в редакторе
interface LanguageContextType {
    locale: Locale;
    setLocale: (locale: Locale) => void;
    t: typeof translations.en; // Используем структуру английского как эталон
}

const LanguageContext = createContext<LanguageContextType | undefined>(undefined);

export function LanguageProvider({ children }: { children: ReactNode }) {
    // По умолчанию ставим английский
    const [locale, setLocaleState] = useState<Locale>('en');

    // При первой загрузке проверяем, сохранял ли пользователь язык ранее
    useEffect(() => {
        const savedLocale = localStorage.getItem('app-locale') as Locale;
        if (savedLocale && translations[savedLocale]) {
            setLocaleState(savedLocale);
        }
    }, []);

    // Функция смены языка с сохранением в localStorage
    const setLocale = (newLocale: Locale) => {
        setLocaleState(newLocale);
        localStorage.setItem('app-locale', newLocale);
    };

    // Выбираем нужный пакет слов на основе текущего языка
    const t = translations[locale];

    return (
        <LanguageContext.Provider value={{ locale, setLocale, t }}>
        {children}
        </LanguageContext.Provider>
    );
}

// Кастомный хук для удобного использования в компонентах
export function useLanguage() {
    const context = useContext(LanguageContext);
    if (context === undefined) {
        throw new Error('useLanguage must be used within a LanguageProvider');
    }
    return context;
}
