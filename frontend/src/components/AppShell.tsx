"use client";

import { useEffect } from "react";

export default function AppShell({ children }: { children: React.ReactNode }) {
    useEffect(() => {
        const handleMiddleClick = (e: MouseEvent) => {
            if (e.button !== 1) return;

            const target = e.target as HTMLElement;
            const el = target.closest("[data-href], a[href]") as HTMLElement | null;
            if (!el) return;

            e.preventDefault();

            const href =
                el.getAttribute("data-href") ||
                (el as HTMLAnchorElement).href;

            if (href) {
                const url = href.startsWith("http")
                    ? href
                    : window.location.origin + href;
                window.open(url, "_blank");
            }
        };

        document.addEventListener("mousedown", handleMiddleClick);
        return () => document.removeEventListener("mousedown", handleMiddleClick);
    }, []);

    return <>{children}</>;
}
