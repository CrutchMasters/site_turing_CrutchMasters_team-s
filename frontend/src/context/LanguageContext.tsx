"use client";

import React, { createContext, useContext, useState, useEffect } from "react";
import { translations, Locale, Translations } from "./translations";

// ── Types ────────────────────────────────────────────────────────────────────
type LanguageContextType = {
  locale: Locale;
  setLocale: (locale: Locale) => void;
  t: Translations;
};

// ── Context ──────────────────────────────────────────────────────────────────
const LanguageContext = createContext<LanguageContextType | undefined>(undefined);

// ── Provider ─────────────────────────────────────────────────────────────────
export const LanguageProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [locale, setLocaleState] = useState<Locale>("ua");

  useEffect(() => {
    const saved = localStorage.getItem("language") as Locale | null;
    if (saved && saved in translations) setLocaleState(saved);
  }, []);

  const setLocale = (next: Locale) => {
    setLocaleState(next);
    localStorage.setItem("language", next);
  };

  return (
    <LanguageContext.Provider value={{ locale, setLocale, t: translations[locale] }}>
      {children}
    </LanguageContext.Provider>
  );
};

// ── Hooks ─────────────────────────────────────────────────────────────────────

/** Primary hook — returns the full translation object for current locale. */
export const useLanguage = () => {
  const ctx = useContext(LanguageContext);
  if (!ctx) throw new Error("useLanguage must be used within a LanguageProvider");
  return ctx;
};

/**
 * Shorthand hook — returns only `t` (translations) + `locale`.
 * Usage:  const { t, locale } = useT();
 */
export const useT = () => {
  const { t, locale } = useLanguage();
  return { t, locale };
};

export const LOCALES: { value: Locale; label: string; flag: string }[] = [
  { value: "ua", label: "Українська", flag: "🇺🇦" },
  { value: "ru", label: "Русский",    flag: "🇷🇺" },
  { value: "en", label: "English",    flag: "🇬🇧" },
];
