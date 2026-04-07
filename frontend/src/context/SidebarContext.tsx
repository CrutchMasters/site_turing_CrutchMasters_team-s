"use client";

import React, { createContext, useContext, useState, useEffect } from "react";

type SidebarContextType = {
    collapsed: boolean;
    toggle: () => void;
};

const SidebarContext = createContext<SidebarContextType | undefined>(undefined);

export function SidebarProvider({ children }: { children: React.ReactNode }) {
    const [collapsed, setCollapsed] = useState(false);

    useEffect(() => {
        const saved = localStorage.getItem("sidebar_collapsed");
        if (saved === "true") setCollapsed(true);
    }, []);

        const toggle = () => {
            setCollapsed((prev) => {
                const next = !prev;
                localStorage.setItem("sidebar_collapsed", String(next));
                return next;
            });
        };

        return (
            <SidebarContext.Provider value={{ collapsed, toggle }}>
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
