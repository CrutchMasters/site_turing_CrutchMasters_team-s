// src/lib/supabase.ts
import { createClient } from "@supabase/supabase-js";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
    auth: {
        persistSession: false,  // ми самі керуємо сесією
        autoRefreshToken: false,
    },
    global: {
        fetch: (url, options = {}) => {
            const token =
            typeof window !== "undefined"
            ? localStorage.getItem("access_token")
            : null;

            if (token) {
                options.headers = {
                    ...((options.headers as Record<string, string>) ?? {}),
                                     Authorization: `Bearer ${token}`,
                };
            }

            return fetch(url, options);
        },
    },
});
