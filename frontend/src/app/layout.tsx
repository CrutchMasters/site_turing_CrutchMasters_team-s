import type { Metadata } from "next";
import { Barlow } from "next/font/google";
import "./globals.css";
import { LanguageProvider } from "@/context/LanguageContext";
import { AuthProvider } from "@/context/AuthContext";

const barlow = Barlow({
  subsets: ["latin"],
  weight: ["400", "500", "600", "700", "800", "900"],
  variable: "--font-barlow",
});

export const metadata: Metadata = {
  title: "Code Future",
  description: "Tournament Platform",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={barlow.variable} suppressHydrationWarning>
    <head>
    {/*
      Этот скрипт выполняется до рендера страницы.
      Он читает localStorage и добавляет класс .dark на <html>
      ещё до того как React загрузится — предотвращает мигание.
      */}
      <script
      dangerouslySetInnerHTML={{
        __html: `
        (function() {
          try {
            var theme = localStorage.getItem('theme');
            if (theme === 'dark') {
              document.documentElement.classList.add('dark');
            } else {
              document.documentElement.classList.remove('dark');
            }
          } catch(e) {}
        })();
        `,
      }}
      />
      </head>
      <body
      className="antialiased min-h-screen transition-colors duration-300"
      style={{ backgroundColor: "var(--bg)", color: "var(--t1)" }}
      suppressHydrationWarning={true}  // ← додай це
      >
      <AuthProvider>
      <LanguageProvider>
      {children}
      </LanguageProvider>
      </AuthProvider>
      </body>
      </html>
  );
}
