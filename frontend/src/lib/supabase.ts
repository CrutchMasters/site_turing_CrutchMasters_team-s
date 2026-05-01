import { createClient } from "@supabase/supabase-js";
import { createBrowserClient } from "@supabase/ssr";

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const SUPABASE_ANON_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

if (!SUPABASE_URL || !SUPABASE_ANON_KEY) {
    throw new Error(
        "Missing NEXT_PUBLIC_SUPABASE_URL or NEXT_PUBLIC_SUPABASE_ANON_KEY env variables"
    );
}

/**
 * Анонімний клієнт — тільки для публічних SELECT-запитів.
 * Не передає JWT, тому RLS-політики на INSERT/UPDATE/DELETE заблокують його.
 */
export const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

// Internal browser client used only for silent token refresh inside authedSupabase.
const _browserClient = createBrowserClient(SUPABASE_URL, SUPABASE_ANON_KEY);

function getTokenExpiry(token: string): number {
    try {
        const payload = JSON.parse(atob(token.split(".")[1]));
        return (payload.exp ?? 0) * 1000;
    } catch {
        return 0;
    }
}

/**
 * Silently refreshes the access token using the stored refresh_token.
 * On success, persists the new tokens and dispatches a "token:refreshed" event
 * so AuthContext can sync its React state.
 *
 * Returns the new access token, or null if refresh failed.
 */
async function silentRefresh(): Promise<string | null> {
    try {
        const saved = typeof window !== "undefined"
        ? localStorage.getItem("refresh_token")
        : null;
        if (!saved) return null;

        const { data, error } = await _browserClient.auth.refreshSession({
            refresh_token: saved,
        });
        if (error || !data?.session) return null;

        const { access_token, refresh_token } = data.session;
        localStorage.setItem("access_token", access_token);
        localStorage.setItem("refresh_token", refresh_token);
        document.cookie = `access_token=${access_token}; path=/; max-age=604800`;

        // Notify AuthContext so it can update its React state without a page reload.
        window.dispatchEvent(
            new CustomEvent("token:refreshed", { detail: { access_token } })
        );

        return access_token;
    } catch {
        return null;
    }
}

/**
 * Аутентифікований клієнт — передає JWT користувача в заголовку Authorization.
 * Використовуй для будь-яких INSERT / UPDATE / DELETE операцій, захищених RLS.
 *
 * Перед створенням клієнта перевіряє чи токен ще живий.
 * Якщо токен протух (або протухне впродовж наступних 30 с) — виконує тихий
 * рефреш через збережений refresh_token. Це захищає від ситуацій, коли браузерна
 * вкладка "засинає" і таймер у AuthContext не спрацьовує вчасно.
 *
 * @param token — JWT з useAuth() → token. Якщо не переданий, клієнт працює як анонімний.
 *
 * @example
 * const client = await authedSupabase(token);
 * const { error } = await client.from("announcements").insert({ title: "Hello" });
 */
export async function authedSupabase(token?: string | null) {
    let activeToken = token ?? null;

    if (activeToken) {
        const expiresAt = getTokenExpiry(activeToken);
        const isExpiredOrExpiringSoon = expiresAt - Date.now() < 30_000; // < 30 seconds left

        if (isExpiredOrExpiringSoon) {
            const refreshed = await silentRefresh();
            if (refreshed) {
                activeToken = refreshed;
            }
            // If refresh failed, fall through with the (possibly expired) token —
            // Supabase will return a 401 and the caller can handle it gracefully.
        }
    }

    return createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
        global: {
            headers: activeToken
            ? { Authorization: `Bearer ${activeToken}` }
            : {},
        },
        auth: {
            // Сесією керує кастомний AuthContext — тут авто-рефреш вимкнено.
            persistSession: false,
            autoRefreshToken: false,
            detectSessionInUrl: false,
        },
    });
}
