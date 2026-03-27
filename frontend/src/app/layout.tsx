import type { Metadata } from "next";
import { Barlow } from "next/font/google";
import "./globals.css";
import { LanguageProvider } from "@/context/LanguageContext";

const barlow = Barlow({
  subsets: ["latin"],
  weight: ["400", "500", "600", "700", "800", "900"],
  variable: "--font-barlow",
});

export const metadata: Metadata = {
  title: "Code Future",
  description: "Tournament Platform",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className={barlow.variable} suppressHydrationWarning>
    {/* Класи bg-(--bg) та text-(--t1) тепер діють на ВСІ сторінки */}
    <body className="antialiased bg-(--bg) text-(--t1) min-h-screen transition-colors duration-300">
    <LanguageProvider>
    {children}
    </LanguageProvider>
    </body>
    </html>
  );
}
