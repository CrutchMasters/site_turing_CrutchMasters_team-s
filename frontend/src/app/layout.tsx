import type { Metadata } from "next";
import { Barlow } from "next/font/google"; // Импортируем Barlow
import "./globals.css";
import { LanguageProvider } from "@/context/LanguageContext";

// Настраиваем шрифт
const barlow = Barlow({
  subsets: ["latin"],
  weight: ["400", "500", "600", "700", "800", "900"],
  variable: "--font-barlow", // Имя переменной для CSS
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
    <html lang="en" className={barlow.variable}><body className="antialiased">
    <LanguageProvider>
    {children}
    </LanguageProvider>
    </body></html>
  );
}
