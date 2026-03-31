import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

const PROTECTED = ["/main_page", "/profile", "/register_team"];
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
        return NextResponse.redirect(new URL("/main_page", request.url));
    }

    return NextResponse.next();
}

export const config = {
    matcher: ["/main_page/:path*", "/profile/:path*", "/register_team/:path*", "/login", "/register"],
};
