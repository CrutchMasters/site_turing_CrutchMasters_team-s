"use client";

import { useEffect } from "react";

export default function AppShell({ children }: { children: React.ReactNode }) {
    useEffect(() => {
        // Native <a href> elements already support:
        // - Left click: SPA navigation via onClick handler
        // - Middle click: browser opens in new background tab natively
        // - Right click: browser shows "Open in new tab" context menu natively
        // No custom JS needed.
    }, []);
    return <>{children}</>;
}
