import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

const PROTECTED = [
    "/dashboard",
"/profile",
"/register_team",
"/jury",
"/rounds",
"/register_tourney",
"/notifications",
];
const ADMIN_ONLY = ["/admin"];
const AUTH_PAGES = ["/login", "/register"];

export function middleware(request: NextRequest) {
    const { pathname } = request.nextUrl;
    const token = request.cookies.get("access_token")?.value;

    // Захищені сторінки — треба токен
    if (PROTECTED.some(p => pathname.startsWith(p)) && !token) {
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
        "/rounds/:path*",
        "/register_tourney/:path*",
        "/notifications/:path*",
        "/login",
        "/register",
    ],
};
