import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
// 1. Импортируем провайдер
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
  title: "CodeFuture | Tournament Platform",
  description: "Advanced environment for IT tournaments",
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
    {/* 2. Оборачиваем всё приложение в провайдер языка */}
    <LanguageProvider>
    {children}
    </LanguageProvider>
    </body>
    </html>
  );
}
