"use client";

import Link from "next/link";
import { useState, ChangeEvent, FormEvent } from "react";

export default function RegisterPage() {
  const [formData, setFormData] = useState({
    username: "",
    login: "",
    email: "",
    password: "",
    confirmPassword: ""
  });
  const [agreed, setAgreed] = useState(false);

  // Валидация: пароли совпадают и не пустые
  const isPasswordMatch = formData.password === formData.confirmPassword;
  const passwordsNotEmpty = formData.password.length > 0;

  // Кнопка становится синей (активной), если есть согласие и пароли верны
  const canSubmit = agreed && isPasswordMatch && passwordsNotEmpty;

  const handleChange = (e: ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target;
    setFormData((prev) => ({ ...prev, [name]: value }));
  };

  const handleSubmit = (e: FormEvent) => {
    e.preventDefault();
    if (canSubmit) {
      console.log("Данные формы:", formData);
      // Здесь будет логика отправки на бэкенд
    }
  };

  return (
    <div className="min-h-screen bg-[#f3f4f6] flex flex-col items-center justify-center font-sans text-slate-900 relative overflow-hidden">

   {/* Декоративный логотип на фоне (водяной знак) */}
<div className="absolute inset-0 flex items-center justify-center opacity-30 pointer-events-none">
  <img 
    src="/logo backround1" 
    alt="Watermark" 
    className="w-[800px] h-[800px] object-contain" 
  />
</div>


      {/* Основной контейнер формы (Glassmorphism) */}
      <div className="z-10 w-full max-w-md bg-white/80 backdrop-blur-xl p-10 rounded-[40px] shadow-2xl border border-white/50 flex flex-col items-center">

        <h1 className="text-4xl font-black text-gray-800 mb-8 tracking-tighter uppercase text-center">
          Code Future
        </h1>

        <form onSubmit={handleSubmit} className="w-full flex flex-col gap-4">
          {/* Поле Username */}
          <input
            name="username"
            type="text"
            placeholder="username ..."
            value={formData.username}
            onChange={handleChange}
            className="w-full px-5 py-3 rounded-xl border border-gray-300 bg-white focus:ring-2 focus:ring-blue-500 outline-none transition-all placeholder:italic text-sm"
            required
          />

          {/* Поле Login */}
          <input
            name="login"
            type="text"
            placeholder="login ..."
            value={formData.login}
            onChange={handleChange}
            className="w-full px-5 py-3 rounded-xl border border-gray-300 bg-white focus:ring-2 focus:ring-blue-500 outline-none transition-all placeholder:italic text-sm"
            required
          />

          {/* Поле Email (Gmail) */}
          <input
            name="email"
            type="email"
            placeholder="gmail ..."
            value={formData.email}
            onChange={handleChange}
            className="w-full px-5 py-3 rounded-xl border border-gray-300 bg-white focus:ring-2 focus:ring-blue-500 outline-none transition-all placeholder:italic text-sm"
            required
          />

          {/* Блок с двумя паролями в одну строку (как на скетче) */}
          <div className="grid grid-cols-2 gap-3">
            <input
              name="password"
              type="password"
              placeholder="password ..."
              value={formData.password}
              onChange={handleChange}
              className="w-full px-4 py-3 rounded-xl border border-gray-300 bg-white focus:ring-2 focus:ring-blue-500 outline-none transition-all placeholder:italic text-sm"
              required
            />
            <input
              name="confirmPassword"
              type="password"
              placeholder="cont. pass..."
              value={formData.confirmPassword}
              onChange={handleChange}
              className={`w-full px-4 py-3 rounded-xl border bg-white focus:ring-2 outline-none transition-all placeholder:italic text-sm ${
                !isPasswordMatch && formData.confirmPassword
                  ? "border-red-500 focus:ring-red-500"
                  : "border-gray-300 focus:ring-blue-500"
              }`}
              required
            />
          </div>

          {/* Галочка Personal */}
          <div className="flex items-center gap-3 py-2">
            <input
              type="checkbox"
              id="privacy"
              checked={agreed}
              onChange={() => setAgreed(!agreed)}
              className="w-5 h-5 cursor-pointer accent-blue-600"
            />
            <label htmlFor="privacy" className="text-sm font-medium text-gray-700 cursor-pointer select-none italic">
              Personal (Privacy Policy)
            </label>
          </div>

          {/* Кнопка регистрации */}
          <button
            type="submit"
            disabled={!canSubmit}
            className={`w-full py-4 rounded-2xl text-2xl font-black shadow-lg transition-all active:scale-[0.97] uppercase tracking-tight ${
              canSubmit
                ? "bg-blue-600 text-white hover:bg-blue-700 cursor-pointer shadow-blue-200"
                : "bg-gray-300 text-gray-500 cursor-not-allowed opacity-70"
            }`}
          >
            Registered
          </button>
        </form>

        {/* Ссылка на вход */}
        <div className="mt-6 text-center">
          <span className="text-gray-400 font-medium italic">Already have an account? </span>
          <Link href="/login" className="text-blue-600 font-bold hover:underline ml-1">
            sign in
          </Link>
        </div>
      </div>

      {/* Кнопка возврата */}
      <Link href="/" className="absolute top-8 left-8 text-gray-400 hover:text-gray-600 text-xs font-bold uppercase tracking-widest transition-colors">
        ← Back to main
      </Link>
    </div>
  );
}
