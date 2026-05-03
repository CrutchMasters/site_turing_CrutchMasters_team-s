import { createClient } from "@supabase/supabase-js";

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const SUPABASE_ANON_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

if (!SUPABASE_URL || !SUPABASE_ANON_KEY) {
    throw new Error(
        "Missing NEXT_PUBLIC_SUPABASE_URL or NEXT_PUBLIC_SUPABASE_ANON_KEY env variables"
    );
}

/**
 * БАГ ФИКС: раньше клиент создавался с persistSession: true и autoRefreshToken: true,
 * но токен хранился в кастомном ключе localStorage ("access_token"), а не в стандартном
 * ключе Supabase ("sb-*-auth-token"). Из-за этого:
 *
 *  1. Supabase-клиент при старте не находил свою сессию → считал пользователя анонимным.
 *  2. Запросы к таблицам с RLS выполнялись без JWT → падали или зависали.
 *  3. autoRefreshToken конфликтовал с логикой рефреша в AuthContext.
 *
 * Решение: отключаем авто-управление сессией (persistSession: false, autoRefreshToken: false)
 * и вручную устанавливаем сессию через setSession() при наличии токенов в localStorage.
 * Это делает клиент синхронным с AuthContext.
 */
export const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
    auth: {
        persistSession: false,      // не используем встроенное хранилище Supabase
        autoRefreshToken: false,    // рефреш управляется AuthContext
        detectSessionInUrl: false,
    },
});

/**
 * Инициализируем сессию Supabase из кастомного localStorage при старте.
 * Вызывается один раз на клиенте — синхронизирует supabase-клиент с токеном
 * который хранит AuthContext, чтобы запросы шли с JWT, а не анонимно.
 */
if (typeof window !== "undefined") {
    const accessToken  = localStorage.getItem("access_token");
    const refreshToken = localStorage.getItem("refresh_token");

    if (accessToken && refreshToken) {
        // setSession не делает сетевых запросов — просто устанавливает токены в памяти клиента.
        // Ошибку игнорируем: если токен протух, AuthContext сам выполнит рефреш.
        supabase.auth.setSession({
            access_token: accessToken,
            refresh_token: refreshToken,
        }).catch(() => { /* silent — AuthContext handles refresh */ });
    }
}

// Слушаем событие обновления токена от AuthContext и синхронизируем сессию Supabase.
// Это гарантирует что после рефреша все запросы идут с новым токеном.
if (typeof window !== "undefined") {
    window.addEventListener("token:refreshed", (e: Event) => {
        const { access_token } = (e as CustomEvent<{ access_token: string }>).detail;
        const refreshToken = localStorage.getItem("refresh_token") ?? "";
        supabase.auth.setSession({
            access_token,
            refresh_token: refreshToken,
        }).catch(() => {});
    });
}

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
 */
async function silentRefresh(): Promise<string | null> {
    try {
        const saved = typeof window !== "undefined"
        ? localStorage.getItem("refresh_token")
        : null;
        if (!saved) return null;

        const { data, error } = await supabase.auth.refreshSession({
            refresh_token: saved,
        });
        if (error || !data?.session) return null;

        const { access_token, refresh_token } = data.session;
        localStorage.setItem("access_token", access_token);
        localStorage.setItem("refresh_token", refresh_token);
        document.cookie = `access_token=${access_token}; path=/; max-age=604800`;

        window.dispatchEvent(
            new CustomEvent("token:refreshed", { detail: { access_token } })
        );

        return access_token;
    } catch {
        return null;
    }
}

/**
 * Аутентифікований клієнт для INSERT / UPDATE / DELETE операцій захищених RLS.
 *
 * @param token — JWT з useAuth() → token.
 */
export async function authedSupabase(token?: string | null) {
    let activeToken = token ?? null;

    if (activeToken) {
        const expiresAt = getTokenExpiry(activeToken);
        const isExpiredOrExpiringSoon = expiresAt - Date.now() < 30_000;

        if (isExpiredOrExpiringSoon) {
            const refreshed = await silentRefresh();
            if (refreshed) {
                activeToken = refreshed;
            }
        }
    }

    return createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
        global: {
            headers: activeToken
            ? { Authorization: `Bearer ${activeToken}` }
            : {},
        },
        auth: {
            persistSession: false,
            autoRefreshToken: false,
            detectSessionInUrl: false,
        },
    });
}
