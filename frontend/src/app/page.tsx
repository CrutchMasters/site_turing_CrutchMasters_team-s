"use client";

import Image from "next/image";
import Link from "next/link";
import { useEffect, useState } from "react";

export default function Home() {
  // Состояние для хранения сообщения от бэкенда (Антона)
  const [backendMessage, setBackendMessage] = useState("Чекаємо відповіді від Антона...");

  // Логика запроса к API
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
    <div className="min-h-screen bg-[#f3f4f6] flex flex-col font-sans text-slate-900">

    {/* --- ШАПКА (HEADER) --- */}
    <header className="w-full bg-white py-3 px-10 flex justify-between items-center shadow-md z-30">
    <div className="flex items-center gap-3">
    <Image
    src="/logo_homepage.svg"
    alt="CodeFuture Logo"
    width={35}
    height={35}
    priority
    />
    <span className="text-xl font-bold tracking-tight text-gray-800 uppercase">CodeFuture</span>
    </div>

    <div className="flex items-center gap-6">
    {/* ТЕПЕРЬ ЭТА КНОПКА ВЕДЕТ НА LOGIN */}
    <Link href="/login">
    <button className="text-sm font-semibold text-gray-500 hover:text-blue-600 transition">
    Sign in
    </button>
    </Link>

    <Link href="/register">
    <button className="px-5 py-2 text-sm font-bold text-blue-600 border-2 border-blue-600 rounded-full hover:bg-blue-600 hover:text-white transition-all duration-300 shadow-sm active:scale-95">
    Sign up
    </button>
    </Link>
    </div>
    </header>

    {/* --- ОСНОВНОЙ КОНТЕНТ --- */}
    <main className="relative flex-grow flex items-center justify-center p-6 overflow-hidden">

   {/* Декоративный логотип на фоне (водяной знак) */}
<div className="absolute inset-0 flex items-center justify-center opacity-30 pointer-events-none">
  <img 
    src="/logo begrund1.png" 
    alt="Watermark" 
    className="w-[800px] h-[800px] object-contain" 
  />
</div>

    <div className="max-w-6xl w-full grid grid-cols-1 md:grid-cols-3 gap-8 items-center z-10">

    {/* Левая карточка: Информация и Бэкенд */}
    <div className="bg-white/95 backdrop-blur-sm p-8 rounded-3xl shadow-xl border border-gray-100 h-full flex flex-col transform hover:-translate-y-1 transition-transform duration-300">
    <h2 className="text-2xl font-black mb-4 border-b pb-2 text-gray-800">Main Site Info</h2>

    {/* Статус от Антона */}
    <div className="bg-blue-50 p-3 rounded-xl mb-6 border-l-4 border-blue-500 text-sm">
    <span className="block font-bold text-blue-700 uppercase text-[10px] tracking-widest">Backend Status:</span>
    <p className="text-blue-900 font-medium italic">{backendMessage}</p>
    </div>

    <p className="mb-4 text-gray-600 text-sm leading-relaxed">
    CodeFuture is an innovative platform for modern developers. Discover our tools, resources, and community. We empower you with:
    </p>
    <ul className="space-y-2 text-gray-700 text-sm mb-6">
    <li className="flex items-center gap-2"><span className="text-blue-500 font-bold">✓</span> Full-stack development guides</li>
    <li className="flex items-center gap-2"><span className="text-blue-500 font-bold">✓</span> A curated list of projects</li>
    <li className="flex items-center gap-2"><span className="text-blue-500 font-bold">✓</span> Active discussion forums</li>
    </ul>
    <p className="mt-auto font-bold text-gray-800">Start your journey today!</p>
    </div>

    {/* Центральный блок: Главная кнопка */}
    <div className="flex flex-col items-center gap-6">
    <Link href="/register" className="w-full max-w-[300px]">
    <button className="bg-blue-600 text-white px-10 py-6 rounded-2xl text-3xl font-black shadow-[0_20px_50px_rgba(37,99,235,0.4)] hover:bg-blue-700 hover:scale-105 transition-all active:scale-95 text-center w-full uppercase tracking-tighter">
    Register
    </button>
    </Link>

    <button className="flex items-center gap-2 bg-zinc-700 text-white px-8 py-3 rounded-xl hover:bg-zinc-800 transition shadow-lg group">
    <span className="text-lg font-bold">Learn More</span>
    <svg className="w-5 h-5 group-hover:translate-y-1 transition-transform duration-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="3" d="M19 9l-7 7-7-7" />
    </svg>
    </button>
    </div>

    {/* Правая карточка: Сообщество */}
    <div className="bg-white/95 backdrop-blur-sm p-8 rounded-3xl shadow-xl border border-gray-100 h-full flex flex-col transform hover:-translate-y-1 transition-transform duration-300">
    <h2 className="text-2xl font-black mb-4 border-b pb-2 text-gray-800">Our Community</h2>
    <h3 className="text-lg font-bold text-blue-600 mb-4 uppercase text-sm tracking-wide">Join Our Ecosystem</h3>
    <p className="mb-4 text-gray-600 text-sm leading-relaxed">
    Be a part of a vibrant developer network. Share knowledge, collaborate on code, and find mentors. Learn how you can:
    </p>
    <ul className="space-y-2 text-gray-700 text-sm mb-6">
    <li className="flex items-center gap-2"><span className="text-green-500 font-bold">★</span> Contribute to open source</li>
    <li className="flex items-center gap-2"><span className="text-green-500 font-bold">★</span> Access exclusive workshops</li>
    <li className="flex items-center gap-2"><span className="text-green-500 font-bold">★</span> Attend global meetups</li>
    </ul>
    <p className="mt-auto font-bold text-gray-800 text-center md:text-left">Connect with like-minded individuals.</p>
    </div>

    </div>
    </main>

    {/* --- ФУТЕР (FOOTER) --- */}
    <footer className="py-6 flex flex-col items-center gap-3 opacity-40 hover:opacity-100 transition-opacity duration-500">
    <div className="flex items-center gap-3">
    <span className="text-[10px] font-bold uppercase tracking-[0.2em] text-gray-500">Created by Crutch Masters</span>
    <div className="h-[1px] w-12 bg-gray-300"></div>
    <Image className="grayscale opacity-50" src="/next.svg" alt="Next.js logo" width={60} height={12} />
    </div>
    </footer>
    </div>
  );
}
