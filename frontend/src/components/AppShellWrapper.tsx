"use client";

import AppShell from "@/components/AppShell";

export default function AppShellWrapper({ children }: { children: React.ReactNode }) {
    return <AppShell>{children}</AppShell>;
}
