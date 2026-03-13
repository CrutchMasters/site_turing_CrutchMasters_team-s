"use client";

import Image from "next/image";
import { useEffect, useState } from "react";

export default function Home() {
  // Сохраняем логику запроса к Антону
  const [backendMessage, setBackendMessage] = useState("Чекаємо відповіді від Антона...");

  useEffect(() => {
    const API_URL = "http://localhost:8000/api/test";
    fetch(API_URL)
    .then((res) => {
      if (!res.ok) throw new Error("Сервер відповів помилкою");
      return res.json();
    })
    .then((data) => {
      setBackendMessage(data.message);
    })
    .catch((err) => {
      console.error(err);
      setBackendMessage("Помилка: не вдалося з'єднатися з бекендом.");
    });
  }, []);

  return (
    <div className="min-h-screen bg-[#e5e7eb] flex flex-col font-sans text-slate-900">

    {/* Шапка с твоим новым логотипом */}
    <header className="w-full bg-white py-3 px-10 flex justify-between items-center shadow-sm z-30">
    <div className="flex items-center gap-3">
    {/* ТВОЕ НОВОЕ ЛОГО */}
    <Image
    src="/logo_homepage.svg"
    alt="CodeFuture Logo"
    width={40}
    height={40}
    priority
    />
    <span className="text-xl font-bold tracking-tight text-gray-800">CodeFuture</span>
    </div>
    <div className="flex gap-4">
    <button className="px-4 py-2 text-sm font-medium border border-gray-300 rounded-md hover:bg-gray-50 transition">Sign in</button>
    <button className="px-4 py-2 text-sm font-medium border border-gray-300 rounded-md hover:bg-gray-50 transition">Sign up</button>
    </div>
    </header>

    {/* Основной блок */}
    <main className="relative flex-grow flex items-center justify-center p-6 overflow-hidden">

    {/* Фоновый декоративный щит (водяной знак) */}
    <div className="absolute inset-0 flex items-center justify-center opacity-5 pointer-events-none">
    <svg width="500" height="500" viewBox="0 0 24 24" fill="currentColor">
    <path d="M12 1L3 5v6c0 5.55 3.84 10.74 9 12 5.16-1.26 9-6.45 9-12V5l-9-4z" />
    </svg>
    </div>

    <div className="max-w-6xl w-full grid grid-cols-1 md:grid-cols-3 gap-8 items-center z-10">

    {/* Левая карточка: Информация */}
    <div className="bg-white/90 backdrop-blur-md p-8 rounded-3xl shadow-xl border border-white h-full flex flex-col">
    <h2 className="text-3xl font-bold mb-4">Main Site Information</h2>
    <div className="bg-blue-50 p-3 rounded-lg mb-4 border-l-4 border-blue-500">
    <p className="text-sm font-semibold text-blue-700">Status from Anton:</p>
    <p className="text-blue-900 italic">{backendMessage}</p>
    </div>
    <p className="mb-4 text-gray-600 leading-relaxed">
    CodeFuture is an innovative platform for modern developers. Discover our tools, resources, and community.
    </p>
    <ul className="space-y-2 text-gray-700 mb-6">
    <li>• Full-stack development guides</li>
    <li>• A curated list of projects</li>
    <li>• Active discussion forums</li>
    <li>• Career opportunities</li>
    </ul>
    <p className="mt-auto font-bold text-gray-800">Start your journey today!</p>
    </div>

    {/* Центр: Кнопки действий */}
    <div className="flex flex-col items-center gap-5">
    <a
    href="/register"
    className="bg-[#4472c4] text-white px-12 py-6 rounded-xl text-3xl font-bold shadow-2xl hover:bg-[#365ba1] hover:scale-105 transition-all active:scale-95 text-center w-full max-w-[280px]"
    >
    Register
    </a>
    <button className="flex items-center gap-2 bg-[#595959] text-white px-8 py-3 rounded-lg hover:bg-[#454545] transition shadow-lg">
    <span className="text-lg">Learn More</span>
    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 9l-7 7-7-7" />
    </svg>
    </button>
    </div>

    {/* Правая карточка: Сообщество */}
    <div className="bg-white/90 backdrop-blur-md p-8 rounded-3xl shadow-xl border border-white h-full flex flex-col">
    <h2 className="text-3xl font-bold mb-4">Our Community</h2>
    <h3 className="text-xl font-semibold text-gray-700 mb-4">Join Our Ecosystem</h3>
    <p className="mb-4 text-gray-600 leading-relaxed">
    Be a part of a vibrant developer network. Share knowledge, collaborate on code, and find mentors.
    </p>
    <ul className="space-y-2 text-gray-700 mb-6">
    <li>• Contribute to open source</li>
    <li>• Access exclusive workshops</li>
    <li>• Attend global meetups</li>
    <li>• Build a professional profile</li>
    </ul>
    <p className="mt-auto font-bold text-gray-800 text-center md:text-left">Connect with like-minded individuals.</p>
    </div>

    </div>
    </main>

    {/* Футер */}
    <footer className="py-6 flex justify-center items-center gap-4 opacity-40 hover:opacity-100 transition-opacity">
    <span className="text-xs font-mono uppercase tracking-widest text-gray-500">Powered by</span>
    <Image className="dark:invert" src="/next.svg" alt="Next.js logo" width={80} height={16} />
    </footer>
    </div>
  );
}
