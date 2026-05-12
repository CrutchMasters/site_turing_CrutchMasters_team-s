import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

// Сторінки, доступні ТІЛЬКИ для залогінених користувачів
const PROTECTED = [
    "/profile",
    "/register_team",
    "/jury",
    "/register_tourney",
    "/notifications",
];
// /dashboard — доступний всім (гості бачать турніри, новини, календар)

// Публічні сторінки для перегляду (без логіну):
// /tournaments, /teams, /rounds — дозволяємо всім
// Але деякі дії (реєстрація, здача роботи) показують банер "увійдіть"

const ADMIN_ONLY = ["/admin"];
const AUTH_PAGES = ["/login", "/register"];

export function middleware(request: NextRequest) {
    const { pathname } = request.nextUrl;
    const token = request.cookies.get("access_token")?.value;

    // Захищені сторінки — треба токен
    if (PROTECTED.some(p => pathname.startsWith(p)) && !token) {
        return NextResponse.redirect(new URL("/login", request.url));
    }

    // Здача роботи — тільки залогінені
    if (pathname.match(/^\/rounds\/[^/]+\/submit/) && !token) {
        return NextResponse.redirect(new URL("/login", request.url));
    }

    // Якщо вже залогінений — не пускаємо на /login /register
    if (AUTH_PAGES.includes(pathname) && token) {
        return NextResponse.redirect(new URL("/dashboard", request.url));
    }

    return NextResponse.next();
}

export const config = {
    matcher: [
        "/dashboard/:path*",
        "/profile/:path*",
        "/register_team/:path*",
        "/jury/:path*",
        "/rounds/:path*/submit/:path*",
        "/register_tourney/:path*",
        "/notifications/:path*",
        "/tournaments/:path*",
        "/teams/:path*",
        "/rounds/:path*",
        "/login",
        "/register",
    ],
};
