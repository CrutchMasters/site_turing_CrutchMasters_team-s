"use client";

import React, { createContext, useContext, useState, useEffect, useCallback, useRef } from "react";

const MOBILE_BREAKPOINT = 1024;
const CLOSE_ANIMATION_DURATION = 300; // ms — должно совпадать с transition в CSS

type SidebarContextType = {
  collapsed: boolean;
  toggle: () => void;
  mobileOpen: boolean;
  isClosing: boolean;
  openMobile: () => void;
  closeMobile: () => void;
};

const SidebarContext = createContext<SidebarContextType | undefined>(undefined);

export function SidebarProvider({ children }: { children: React.ReactNode }) {
  const [collapsed, setCollapsed] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);
  const [isClosing, setIsClosing] = useState(false);
  const closeTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const wasMobileRef = useRef<boolean | null>(null);

  useEffect(() => {
    const isMobileNow = window.innerWidth < MOBILE_BREAKPOINT;
    wasMobileRef.current = isMobileNow;

    if (!isMobileNow) {
      const saved = localStorage.getItem("sidebar_collapsed");
      if (saved === "true") setCollapsed(true);
    }

    const handleResize = () => {
      const isMobile = window.innerWidth < MOBILE_BREAKPOINT;
      const wasMobile = wasMobileRef.current;

      if (wasMobile === isMobile) return;

      if (wasMobile && !isMobile) {
        setMobileOpen(false);
        setIsClosing(false);
        const saved = localStorage.getItem("sidebar_collapsed");
        setCollapsed(saved === "true");
      } else if (!wasMobile && isMobile) {
        setCollapsed(false);
        setMobileOpen(false);
        setIsClosing(false);
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

  const openMobile = useCallback(() => {
    if (closeTimerRef.current) {
      clearTimeout(closeTimerRef.current);
      closeTimerRef.current = null;
    }
    setIsClosing(false);
    setMobileOpen(true);
  }, []);

  // Плавное закрытие: сначала ставим isClosing=true (запускает анимацию slide-out),
  // затем через CLOSE_ANIMATION_DURATION ms реально убираем из DOM
  const closeMobile = useCallback(() => {
    if (!mobileOpen) return;
    setIsClosing(true);
    if (closeTimerRef.current) clearTimeout(closeTimerRef.current);
    closeTimerRef.current = setTimeout(() => {
      setMobileOpen(false);
      setIsClosing(false);
      closeTimerRef.current = null;
    }, CLOSE_ANIMATION_DURATION);
  }, [mobileOpen]);

  return (
    <SidebarContext.Provider value={{ collapsed, toggle, mobileOpen, isClosing, openMobile, closeMobile }}>
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
