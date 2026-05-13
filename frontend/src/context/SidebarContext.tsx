"use client";

import React, { createContext, useContext, useState, useEffect, useCallback, useRef } from "react";

const MOBILE_BREAKPOINT = 1024;

type SidebarContextType = {
  collapsed: boolean;
  toggle: () => void;
  mobileOpen: boolean;
  openMobile: () => void;
  closeMobile: () => void;
};

const SidebarContext = createContext<SidebarContextType | undefined>(undefined);

export function SidebarProvider({ children }: { children: React.ReactNode }) {
  const [collapsed, setCollapsed] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);

  // Отслеживаем предыдущий breakpoint чтобы реагировать на переходы
  const wasMobileRef = useRef<boolean | null>(null);

  useEffect(() => {
    const isMobileNow = window.innerWidth < MOBILE_BREAKPOINT;
    wasMobileRef.current = isMobileNow;

    // collapsed загружаем из localStorage только на десктопе
    if (!isMobileNow) {
      const saved = localStorage.getItem("sidebar_collapsed");
      if (saved === "true") setCollapsed(true);
    }

    const handleResize = () => {
      const isMobile = window.innerWidth < MOBILE_BREAKPOINT;
      const wasMobile = wasMobileRef.current;

      if (wasMobile === isMobile) return; // breakpoint не изменился — ничего не делаем

      if (wasMobile && !isMobile) {
        // мобильный → десктоп: закрыть drawer, восстановить collapsed
        setMobileOpen(false);
        const saved = localStorage.getItem("sidebar_collapsed");
        setCollapsed(saved === "true");
      } else if (!wasMobile && isMobile) {
        // десктоп → мобильный: сбросить collapsed, закрыть drawer
        setCollapsed(false);
        setMobileOpen(false);
      }

      wasMobileRef.current = isMobile;
    };

    window.addEventListener("resize", handleResize);
    return () => window.removeEventListener("resize", handleResize);
  }, []);

  const toggle = useCallback(() => {
    setCollapsed((prev) => {
      const next = !prev;
      localStorage.setItem("sidebar_collapsed", String(next));
      return next;
    });
  }, []);

  const openMobile  = useCallback(() => setMobileOpen(true), []);
  const closeMobile = useCallback(() => setMobileOpen(false), []);

  return (
    <SidebarContext.Provider value={{ collapsed, toggle, mobileOpen, openMobile, closeMobile }}>
      {children}
    </SidebarContext.Provider>
  );
}

export function useSidebar() {
  const context = useContext(SidebarContext);
  if (!context) {
    throw new Error("useSidebar must be used inside SidebarProvider");
  }
  return context;
}