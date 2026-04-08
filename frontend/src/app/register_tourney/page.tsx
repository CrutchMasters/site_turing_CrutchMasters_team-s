'use client';
import React, { useState, useEffect, useRef } from 'react';
import { useRouter } from 'next/navigation';
import {
  Bold, Italic, Underline, List, Quote, Type, Zap
} from 'lucide-react';

import Sidebar from "@/components/Sidebar";
import MobileHeader from "@/components/MobileHeader";
import { useTheme } from "@/hooks/useTheme";
import { useT } from "@/context/LanguageContext";
import { useAuth } from "@/context/AuthContext";

// Возможные состояния доступа:
// 'loading'    — auth ещё грузится
// 'checking'   — показываем модалку «точно хотите зайти?» + таймер
// 'denied'     — таймер вышел / нажал «Да» → глитч 403
// 'allowed'    — доступ разрешён
type AccessState = 'loading' | 'checking' | 'denied' | 'allowed';

const COUNTDOWN_SEC = 5;

export default function RegisterTourney() {
  const { dark } = useTheme();
  const { t } = useT();
  const { user, isLoading } = useAuth();
  const router = useRouter();

  const [isMobileSidebarOpen, setIsMobileSidebarOpen] = useState(false);
  const [accessState, setAccessState] = useState<AccessState>('loading');
  const [countdown, setCountdown] = useState(COUNTDOWN_SEC);

  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // ── Определяем доступ после загрузки auth ──────────────────────────────────
  useEffect(() => {
    if (isLoading) return;

    if (!user) {
      router.push('/login');
      return;
    }

    const allowed = user.role === 'admin' || user.role === 'superadmin';
    if (allowed) {
      setAccessState('allowed');
    } else {
      // Нет прав → показываем модалку с таймером
      setAccessState('checking');
      setCountdown(COUNTDOWN_SEC);
    }
  }, [isLoading, user, router]);

  // ── Обратный отсчёт пока состояние 'checking' ─────────────────────────────
  useEffect(() => {
    if (accessState !== 'checking') return;

    timerRef.current = setInterval(() => {
      setCountdown(prev => {
        if (prev <= 1) {
          clearInterval(timerRef.current!);
          setAccessState('denied'); // таймер вышел → глитч 403
          return 0;
        }
        return prev - 1;
      });
    }, 1000);

    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, [accessState]);

  // ── Обработчики кнопок модалки ─────────────────────────────────────────────
  const handleConfirmYes = () => {
    if (timerRef.current) clearInterval(timerRef.current);
    setAccessState('denied'); // «Да, показать» → глитч-403
  };

  const handleConfirmNo = () => {
    if (timerRef.current) clearInterval(timerRef.current);
    router.push('/login'); // «Нет, уйти» → на login
  };

  // ══════════════════════════════════════════════════════════════════════════
  // RENDER: Loading
  // ══════════════════════════════════════════════════════════════════════════
  if (accessState === 'loading' || isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center" style={{ background: 'var(--bg)' }}>
        <div className="w-8 h-8 border-2 border-blue-600 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  // ══════════════════════════════════════════════════════════════════════════
  // RENDER: Модалка-предупреждение с таймером
  // ══════════════════════════════════════════════════════════════════════════
  if (accessState === 'checking') {
    const progress = ((COUNTDOWN_SEC - countdown) / COUNTDOWN_SEC) * 100;
    const circumference = 2 * Math.PI * 28; // r=28

    return (
      <div
        className="min-h-screen flex items-center justify-center relative overflow-hidden"
        style={{ background: 'var(--bg)', color: 'var(--t1)' }}
      >
        <style>{`
          @keyframes fadeInModal {
            from { opacity: 0; transform: scale(0.95) translateY(16px); }
            to   { opacity: 1; transform: scale(1)    translateY(0); }
          }
          @keyframes pulse-ring {
            0%   { box-shadow: 0 0 0 0    rgba(239,68,68,0.35); }
            70%  { box-shadow: 0 0 0 14px rgba(239,68,68,0); }
            100% { box-shadow: 0 0 0 0    rgba(239,68,68,0); }
          }
          .modal-card  { animation: fadeInModal 0.4s cubic-bezier(.22,1,.36,1) both; }
          .pulse-btn   { animation: pulse-ring 1.4s ease-out infinite; }
        `}</style>

        {/* Размытые блобы */}
        <div className="absolute inset-0 pointer-events-none">
          <div className="absolute -top-40 -left-40 w-[600px] h-[600px] rounded-full opacity-[0.07] blur-3xl"
            style={{ background: 'radial-gradient(circle, #ef4444, transparent)' }} />
          <div className="absolute -bottom-40 -right-40 w-[500px] h-[500px] rounded-full opacity-[0.07] blur-3xl"
            style={{ background: 'radial-gradient(circle, #f97316, transparent)' }} />
        </div>

        {/* Карточка */}
        <div
          className="modal-card relative z-10 w-full max-w-md mx-4 rounded-2xl p-8 border"
          style={{
            background: 'var(--card)',
            borderColor: 'rgba(239,68,68,0.3)',
            boxShadow: '0 0 60px rgba(239,68,68,0.08), 0 24px 48px rgba(0,0,0,0.15)'
          }}
        >
          {/* SVG-кольцо + число */}
          <div className="flex flex-col items-center mb-6">
            <div className="relative w-20 h-20 mb-4">
              <svg className="w-20 h-20 -rotate-90" viewBox="0 0 64 64">
                <circle cx="32" cy="32" r="28" fill="none"
                  stroke="rgba(239,68,68,0.15)" strokeWidth="4" />
                <circle cx="32" cy="32" r="28" fill="none"
                  stroke="#ef4444" strokeWidth="4" strokeLinecap="round"
                  strokeDasharray={circumference}
                  strokeDashoffset={circumference * (progress / 100)}
                  style={{ transition: 'stroke-dashoffset 0.9s linear' }}
                />
              </svg>
              <div className="absolute inset-0 flex items-center justify-center">
                <span className="text-2xl font-black tabular-nums" style={{ color: '#ef4444' }}>
                  {countdown}
                </span>
              </div>
            </div>

            <h2 className="text-xl font-black text-center mb-1" style={{ color: 'var(--t1)' }}>
              ⚠️ Ограниченный доступ
            </h2>
            <p className="text-sm text-center" style={{ color: 'var(--t2)' }}>
              У вас нет прав для просмотра этой страницы
            </p>
          </div>

          <div className="h-px mb-6" style={{ background: 'var(--brd)' }} />

          <p className="text-base font-semibold text-center mb-2" style={{ color: 'var(--t1)' }}>
            Точно хотите просмотреть данную страницу?
          </p>
          <p className="text-xs text-center mb-6" style={{ color: 'var(--t2)' }}>
            Через{' '}
            <span className="font-bold text-red-500">{countdown} сек</span>
            {' '}вы автоматически увидите, что ждёт нарушителей 🐇
          </p>

          <div className="flex gap-3">
            <button
              onClick={handleConfirmYes}
              className="pulse-btn flex-1 py-3 rounded-xl font-black text-sm uppercase tracking-wider text-white transition-all active:scale-95"
              style={{ background: '#ef4444' }}
            >
              Да, показать
            </button>
            <button
              onClick={handleConfirmNo}
              className="flex-1 py-3 rounded-xl font-black text-sm uppercase tracking-wider border transition-all active:scale-95 hover:opacity-80"
              style={{ borderColor: 'var(--brd)', color: 'var(--t2)', background: 'var(--bg)' }}
            >
              Нет, уйти
            </button>
          </div>

          <p className="text-center text-xs mt-4" style={{ color: 'var(--t2)', opacity: 0.5 }}>
            «Нет» → вернёт на страницу входа
          </p>
        </div>
      </div>
    );
  }

  // ══════════════════════════════════════════════════════════════════════════
  // RENDER: 403 Глитч — Белый Кролик
  // ══════════════════════════════════════════════════════════════════════════
  if (accessState === 'denied') {
    return (
      <div
        className="min-h-screen flex flex-col items-center justify-center relative overflow-hidden"
        style={{ background: 'var(--bg)', color: 'var(--t1)' }}
      >
        <style>{`
          @keyframes glitch {
            0%   { clip-path: inset(0 0 95% 0);  transform: translate(-4px,0) skewX(-1deg); }
            10%  { clip-path: inset(60% 0 30% 0); transform: translate(4px,0) skewX(1deg); }
            20%  { clip-path: inset(30% 0 60% 0); transform: translate(-2px,0); }
            30%  { clip-path: inset(80% 0 5% 0);  transform: translate(3px,0) skewX(-0.5deg); }
            40%  { clip-path: inset(10% 0 85% 0); transform: translate(-3px,0); }
            50%  { clip-path: inset(50% 0 45% 0); transform: translate(2px,0) skewX(1deg); }
            60%  { clip-path: inset(20% 0 70% 0); transform: translate(-4px,0); }
            70%  { clip-path: inset(70% 0 10% 0); transform: translate(4px,0) skewX(-1deg); }
            80%  { clip-path: inset(40% 0 50% 0); transform: translate(-2px,0); }
            90%  { clip-path: inset(5% 0 90% 0);  transform: translate(3px,0); }
            100% { clip-path: inset(0 0 95% 0);   transform: translate(0,0); }
          }
          @keyframes fadeSlideUp {
            from { opacity: 0; transform: translateY(30px); }
            to   { opacity: 1; transform: translateY(0); }
          }
          @keyframes rabbit-fall {
            0%   { top: -80px; opacity: 0; transform: translateX(-50%) rotate(0deg); }
            30%  { opacity: 1; }
            100% { top: 110%;  opacity: 0; transform: translateX(-50%) rotate(720deg); }
          }
          @keyframes scanline {
            0%   { transform: translateY(-100%); }
            100% { transform: translateY(100vh); }
          }
          .glitch-text { position: relative; }
          .glitch-text::before,
          .glitch-text::after {
            content: attr(data-text);
            position: absolute;
            inset: 0;
            font: inherit;
            text-align: inherit;
          }
          .glitch-text::before {
            color: #3b82f6;
            animation: glitch 2.5s infinite steps(1);
            animation-delay: 0.1s;
          }
          .glitch-text::after {
            color: #8b5cf6;
            animation: glitch 2.5s infinite steps(1);
            animation-delay: 0.35s;
          }
          .rabbit-falling {
            position: absolute;
            font-size: 3rem;
            left: 50%;
            animation: rabbit-fall 4s ease-in infinite;
          }
          .scanline {
            position: absolute;
            left: 0; right: 0;
            height: 3px;
            background: linear-gradient(90deg, transparent, rgba(59,130,246,0.3), transparent);
            animation: scanline 4s linear infinite;
            pointer-events: none;
          }
          .fade-up   { animation: fadeSlideUp 0.7s cubic-bezier(.22,1,.36,1) both; }
          .fade-up-1 { animation: fadeSlideUp 0.7s cubic-bezier(.22,1,.36,1) 0.15s both; }
          .fade-up-2 { animation: fadeSlideUp 0.7s cubic-bezier(.22,1,.36,1) 0.30s both; }
        `}</style>

        {/* Фоновые блобы */}
        <div className="absolute inset-0 overflow-hidden pointer-events-none">
          <div className="absolute -top-32 -left-32 w-[500px] h-[500px] rounded-full opacity-10 blur-3xl"
            style={{ background: 'radial-gradient(circle, #3b82f6, transparent)' }} />
          <div className="absolute -bottom-32 -right-32 w-[400px] h-[400px] rounded-full opacity-10 blur-3xl"
            style={{ background: 'radial-gradient(circle, #8b5cf6, transparent)' }} />
        </div>

        <div className="scanline" />
        <span className="rabbit-falling select-none" aria-hidden="true">🐇</span>

        <div className="relative z-10 text-center px-6 max-w-lg">
          <div
            className="glitch-text text-[120px] sm:text-[160px] font-black leading-none mb-4 select-none fade-up"
            data-text="403"
            style={{ color: 'var(--t1)', letterSpacing: '-0.05em' }}
          >
            403
          </div>

          <p className="fade-up-1 text-lg sm:text-2xl font-black uppercase tracking-tight mb-2"
            style={{ color: 'var(--t1)' }}>
            Ах ты коварный искатель потайных путей,
          </p>
          <p className="fade-up-1 text-lg sm:text-2xl font-black uppercase tracking-tight mb-8"
            style={{ color: '#3b82f6' }}>
            привет от Белого Кролика 🐇
          </p>

          <p className="fade-up-2 text-xs font-bold uppercase tracking-[0.3em] mb-10"
            style={{ color: 'var(--t2)' }}>
            Эта страница только для администраторов
          </p>

          <div className="fade-up-2 flex flex-col sm:flex-row gap-3 justify-center">
            <button
              onClick={() => router.push('/dashboard')}
              className="px-8 py-3.5 rounded-2xl font-black text-xs uppercase tracking-widest bg-blue-600 text-white hover:bg-blue-700 active:scale-95 transition-all shadow-lg shadow-blue-600/20"
            >
              ← Вернуться на дашборд
            </button>
            <button
              onClick={() => router.push('/')}
              className="px-8 py-3.5 rounded-2xl font-black text-xs uppercase tracking-widest border transition-all active:scale-95"
              style={{ borderColor: 'var(--brd)', color: 'var(--t2)', background: 'var(--bg)' }}
            >
              На главную
            </button>
          </div>
        </div>
      </div>
    );
  }

  // ══════════════════════════════════════════════════════════════════════════
  // RENDER: Основной вид (только admin / superadmin)
  // ══════════════════════════════════════════════════════════════════════════
  return (
    <div className="flex h-screen font-sans transition-colors"
      style={{ background: 'var(--bg)', color: 'var(--t1)' }}>

      {/* Фоновый логотип с блюром — как на main_page */}
      <div className={`fixed inset-0 flex items-center justify-center pointer-events-none z-0 ${dark ? "opacity-10" : "opacity-5"}`}>
        <img
          src="/logo_background1.png"
          alt=""
          className={`w-[min(1000px,90vw)] h-[min(1000px,90vw)] object-contain blur-sm ${dark ? "invert" : ""}`}
        />
      </div>

      {/* Sidebar */}
      <div className={`fixed inset-y-0 left-0 z-50 lg:relative transition-transform duration-300
        ${isMobileSidebarOpen ? 'translate-x-0' : '-translate-x-full lg:translate-x-0'}`}>
        <Sidebar />
      </div>

      {/* Overlay мобильного сайдбара */}
      {isMobileSidebarOpen && (
        <div
          className="fixed inset-0 bg-black/50 backdrop-blur-sm z-40 lg:hidden"
          onClick={() => setIsMobileSidebarOpen(false)}
        />
      )}

      {/* Main */}
      <main className="flex-1 overflow-y-auto relative z-10">
        <MobileHeader
          onOpenSidebar={() => setIsMobileSidebarOpen(true)}
          title={t.tourney?.create ?? 'Створення турніру'}
        />

        <div className="p-6 md:p-10 max-w-5xl mx-auto">

          <div className="mb-6">
            <h1 className="text-2xl font-semibold">
              {t.tourney?.createAdmin ?? 'Створення турніру (Admin)'}
            </h1>
          </div>

          <div className="rounded-xl shadow-sm border p-8 max-w-3xl"
            style={{ background: 'var(--card)', borderColor: 'var(--brd)' }}>

            <h2 className="text-lg font-bold mb-6">
              {t.tourney?.createNew ?? 'Створення нового турніру'}
            </h2>

            <form className="space-y-8" onSubmit={(e) => e.preventDefault()}>

              {/* ── РАЗДЕЛ 1 ── */}
              <section>
                <h3 className="text-base font-semibold mb-4">
                  1. {t.tourney?.general ?? 'Загальна інформація'}
                </h3>
                <div className="space-y-4">

                  <div>
                    <label className="block text-sm font-medium mb-1" style={{ color: 'var(--t2)' }}>
                      {t.tourney?.name ?? 'Назва турніру'}
                    </label>
                    <input
                      type="text"
                      placeholder={t.tourney?.namePlaceholder ?? 'Назва турніру (покажчик)'}
                      className="w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 outline-none text-sm"
                      style={{ background: 'var(--bg)', borderColor: 'var(--brd)', color: 'var(--t1)' }}
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium mb-1" style={{ color: 'var(--t2)' }}>
                      {t.tourney?.desc ?? 'Опис / Правила'}
                    </label>
                    <div className="border rounded-lg overflow-hidden focus-within:ring-2 focus-within:ring-blue-500"
                      style={{ borderColor: 'var(--brd)' }}>
                      <div className="border-b px-3 py-2 flex items-center space-x-1"
                        style={{ background: 'var(--bg)', borderColor: 'var(--brd)' }}>
                        {[Bold, Italic, Underline, List, Quote, Type].map((Icon, i) => (
                          <button key={i} type="button"
                            className="p-1.5 rounded transition-opacity hover:opacity-60">
                            <Icon className="w-4 h-4" style={{ color: 'var(--t2)' }} />
                          </button>
                        ))}
                      </div>
                      <textarea
                        rows={4}
                        placeholder={t.tourney?.descPlaceholder ?? 'Введіть опис турніру...'}
                        className="w-full px-4 py-3 outline-none resize-y text-sm bg-transparent"
                        style={{ color: 'var(--t1)' }}
                      />
                    </div>
                  </div>
                </div>
              </section>

              {/* ── РАЗДЕЛ 2 ── */}
              <section>
                <h3 className="text-base font-semibold mb-4">
                  2. {t.tourney?.time ?? 'Час та Умови'}
                </h3>
                <div className="space-y-4">

                  <div>
                    <div className="flex justify-between items-center mb-1">
                      <label className="text-sm font-medium" style={{ color: 'var(--t2)' }}>
                        {t.tourney?.start ?? 'Дата та час старту турніру'}
                      </label>
                      <span className="text-xs text-red-500 flex items-center gap-1">
                        <Zap className="w-3 h-3 fill-red-500" />
                        {t.common?.required ?? "Обов'язково"}
                      </span>
                    </div>
                    <input type="datetime-local"
                      className="w-full px-4 py-2 border rounded-lg text-sm"
                      style={{ background: 'var(--bg)', borderColor: 'var(--brd)', color: 'var(--t1)' }}
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium mb-1" style={{ color: 'var(--t2)' }}>
                      {t.tourney?.registration ?? 'Вікно реєстрації команд'}
                    </label>
                    <div className="grid md:grid-cols-2 gap-4">
                      <input type="datetime-local"
                        className="px-4 py-2 border rounded-lg"
                        style={{ background: 'var(--bg)', borderColor: 'var(--brd)', color: 'var(--t1)' }} />
                      <input type="datetime-local"
                        className="px-4 py-2 border rounded-lg"
                        style={{ background: 'var(--bg)', borderColor: 'var(--brd)', color: 'var(--t1)' }} />
                    </div>
                  </div>

                  <div>
                    <div className="flex justify-between mb-1">
                      <label className="text-sm font-medium" style={{ color: 'var(--t2)' }}>
                        {t.tourney?.maxTeams ?? 'Максимальна кількість команд'}
                      </label>
                      <span className="text-xs" style={{ color: 'var(--t2)' }}>
                        ({t.common?.optional ?? 'Опціонально'})
                      </span>
                    </div>
                    <input type="number" min={0} placeholder="0"
                      className="w-full px-4 py-2 border rounded-lg"
                      style={{ background: 'var(--bg)', borderColor: 'var(--brd)', color: 'var(--t1)' }}
                    />
                  </div>
                </div>
              </section>

              {/* ── РАЗДЕЛ 3 ── */}
              <section>
                <h3 className="text-base font-semibold mb-4">
                  3. {t.tourney?.format ?? 'Формат'}
                </h3>
                <div>
                  <label className="block text-sm font-medium mb-1" style={{ color: 'var(--t2)' }}>
                    {t.tourney?.rounds ?? 'Кількість раундів'}{' '}
                    <span style={{ color: 'var(--t2)' }}>
                      ({t.tourney?.min1 ?? 'Мінімально - 1'})
                    </span>
                  </label>
                  <select
                    defaultValue=""
                    className="w-full px-4 py-2 border rounded-lg"
                    style={{ background: 'var(--bg)', borderColor: 'var(--brd)', color: 'var(--t1)' }}
                  >
                    <option value="" disabled>{t.common?.choose ?? 'Обрати...'}</option>
                    <option value="1">1 раунд</option>
                    <option value="3">3 раунди (Bo3)</option>
                    <option value="5">5 раундів (Bo5)</option>
                  </select>
                </div>
              </section>

              {/* ── Кнопки ── */}
              <div className="pt-4 flex gap-3">
                <button type="submit"
                  className="px-6 py-2.5 bg-blue-600 hover:bg-blue-700 text-white text-sm font-medium rounded-lg transition-colors">
                  {t.tourney?.createBtn ?? 'Створити турнір'}
                </button>
                <button type="button" onClick={() => router.back()}
                  className="px-6 py-2.5 border text-sm rounded-lg transition-colors hover:opacity-80"
                  style={{ background: 'var(--bg)', borderColor: 'var(--brd)', color: 'var(--t2)' }}>
                  {t.common?.cancel ?? 'Скасувати'}
                </button>
              </div>

            </form>
          </div>
        </div>
      </main>
    </div>
  );
}
