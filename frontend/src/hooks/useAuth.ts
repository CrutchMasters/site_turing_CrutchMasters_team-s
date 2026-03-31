"use client";
import { createBrowserClient } from "@supabase/ssr";
import { useEffect, useState, useMemo } from "react";
import { useRouter } from "next/navigation";

export type UserProfile = {
    id: string;
    login: string;
    username: string;
    email: string;
    avatar_url: string | null;
    role: "user" | "admin" | "superadmin";
    status: string;
};

export function useAuth(requireAuth = true) {
    const [profile, setProfile] = useState<UserProfile | null>(null);
    const [loading, setLoading] = useState(true);
    const router = useRouter();

    const supabase = useMemo(() => createBrowserClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL ?? "",
        process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? ""
    ), []);

    useEffect(() => {
        // Перевіряємо поточну сесію
        const getSession = async () => {
            const { data: { session } } = await supabase.auth.getSession();

            if (!session) {
                setLoading(false);
                if (requireAuth) router.push("/login");
                return;
            }

            // Завантажуємо профіль з таблиці profiles
            const { data } = await supabase
            .from("profiles")
            .select("*")
            .eq("id", session.user.id)
            .single();

            setProfile(data);
            setLoading(false);
        };

        getSession();

        // Слухаємо зміни сесії (логін/логаут)
        const { data: { subscription } } = supabase.auth.onAuthStateChange(
            async (event, session) => {
                if (event === "SIGNED_OUT" || !session) {
                    setProfile(null);
                    if (requireAuth) router.push("/login");
                } else if (event === "SIGNED_IN" && session) {
                    const { data } = await supabase
                    .from("profiles")
                    .select("*")
                    .eq("id", session.user.id)
                    .single();
                    setProfile(data);
                }
            }
        );

        return () => subscription.unsubscribe();
    }, []);

    const logout = async () => {
        await supabase.auth.signOut();
        router.push("/");
    };

    const isAdmin = profile?.role === "admin" || profile?.role === "superadmin";
    const isSuperAdmin = profile?.role === "superadmin";

    return { profile, loading, logout, isAdmin, isSuperAdmin };
}
