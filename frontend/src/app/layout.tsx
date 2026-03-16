// src/app/layout.tsx
import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
// Импортируем провайдер
import { LanguageProvider } from "@/context/LanguageContext";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
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
    <html lang="en">
    <body
    className={`${geistSans.variable} ${geistMono.variable} antialiased`}
    >
    {/* Оборачиваем все приложение здесь */}
    <LanguageProvider>
    {children}
    </LanguageProvider>
    </body>
    </html>
  );
}
