//site_turing_CrutchMasters_team-s/frontend/src/app/profile/page.tsx
"use client";

import React, { useState, useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import {
  User, Mail, Shield, ChevronRight, UserCircle, ArrowLeft, Loader,
  Users, Crown, ExternalLink, Lock, Eye, EyeOff, KeyRound,
  CheckCircle, AlertCircle, RefreshCw, Pencil, X, Save,
} from "lucide-react";
import { useTheme } from "@/hooks/useTheme";
import { useAuth } from "@/context/AuthContext";
import { supabase } from "@/lib/supabase";
import Sidebar from "@/components/Sidebar";
import MobileHeader from "@/components/MobileHeader";

const API_URL =
typeof window !== "undefined" && window.location.hostname === "localhost"
? "http://localhost:8000"
: "https://site-turing-crutchmasters-team-s.onrender.com";

const ROLES = ["user", "jury", "admin"] as const;
type Role = "user" | "jury" | "admin" | "superadmin";

const roleBadgeColor: Record<Role, string> = {
  user:       "bg-gray-500/10 text-gray-500 border-gray-500/20",
  jury:       "bg-purple-500/10 text-purple-500 border-purple-500/20",
  admin:      "bg-orange-500/10 text-orange-500 border-orange-500/20",
  superadmin: "bg-red-500/10 text-red-500 border-red-500/20",
};

interface UserTeam {
  id: string;
  name: string;
  city_school_org?: string;
  captain_id?: string;
  members_ids?: string[];
}

// ── Teams hook ────────────────────────────────────────────────────────────────
function useUserTeams(userId: string | undefined) {
  const [teams, setTeams] = useState<UserTeam[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!userId) return;
    const run = async () => {
      setLoading(true);
      try {
        const { data: captainTeams } = await supabase
        .from("teams").select("id, name, city_school_org, captain_id, members_ids").eq("captain_id", userId);
        const { data: memberTeams } = await supabase
        .from("teams").select("id, name, city_school_org, captain_id, members_ids").contains("members_ids", JSON.stringify([userId]));
        const all = [...(captainTeams ?? []), ...(memberTeams ?? [])];
        setTeams(all.filter((t, i, a) => a.findIndex(x => x.id === t.id) === i));
      } finally {
        setLoading(false);
      }
    };
    run();
  }, [userId]);

  return { teams, loading };
}

// ── 6-digit code input ────────────────────────────────────────────────────────
function CodeInput({ value, onChange, disabled }: { value: string; onChange: (v: string) => void; disabled?: boolean }) {
  const inputs = useRef<(HTMLInputElement | null)[]>([]);
  const digits = value.padEnd(6, "").slice(0, 6).split("");

  const handleChange = (i: number, v: string) => {
    const d = v.replace(/\D/g, "").slice(-1);
    const next = digits.map((c, idx) => (idx === i ? d : c)).join("").slice(0, 6);
    onChange(next);
    if (d && i < 5) inputs.current[i + 1]?.focus();
  };

    const handleKeyDown = (i: number, e: React.KeyboardEvent) => {
      if (e.key === "Backspace" && !digits[i] && i > 0) {
        inputs.current[i - 1]?.focus();
        const next = digits.map((c, idx) => (idx === i - 1 ? "" : c)).join("");
        onChange(next);
      }
      if (e.key === "ArrowLeft" && i > 0) inputs.current[i - 1]?.focus();
      if (e.key === "ArrowRight" && i < 5) inputs.current[i + 1]?.focus();
    };

      const handlePaste = (e: React.ClipboardEvent) => {
        e.preventDefault();
        const pasted = e.clipboardData.getData("text").replace(/\D/g, "").slice(0, 6);
        onChange(pasted);
        const focusIdx = Math.min(pasted.length, 5);
        inputs.current[focusIdx]?.focus();
      };

      return (
        <div className="flex gap-2 justify-center">
        {Array.from({ length: 6 }).map((_, i) => (
          <input
          key={i}
          ref={el => { inputs.current[i] = el; }}
          type="text"
          inputMode="numeric"
          maxLength={1}
          value={digits[i] || ""}
          onChange={e => handleChange(i, e.target.value)}
          onKeyDown={e => handleKeyDown(i, e)}
          onPaste={handlePaste}
          disabled={disabled}
          className={`w-11 h-14 text-center text-xl font-black rounded-2xl border-2 bg-(--bg) text-(--t1) outline-none transition-all disabled:opacity-40
            ${digits[i]
              ? "border-blue-600 bg-blue-600/5 shadow-sm shadow-blue-600/20"
              : "border-(--brd) focus:border-blue-600 focus:bg-blue-600/5"
            }`}
            />
        ))}
        </div>
      );
}

// ─────────────────────────────────────────────────────────────────────────────
// Edit Profile + Password Change (inline, inside edit mode)
// ─────────────────────────────────────────────────────────────────────────────
type PwStep = "idle" | "sending" | "code" | "verifying" | "newpw" | "done";

function EditProfileSection({
  profileUser,
  onSave,
  onCancel,
}: {
  profileUser: any;
  onSave: (updated: { username: string; login: string }) => void;
  onCancel: () => void;
}) {
  const [username, setUsername] = useState(profileUser.username ?? "");
  const [login, setLogin] = useState(profileUser.login ?? "");
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);

  // Password change state
  const [pwStep, setPwStep] = useState<PwStep>("idle");
  const [code, setCode] = useState("");
  const [newPw, setNewPw] = useState("");
  const [confirmPw, setConfirmPw] = useState("");
  const [showPw, setShowPw] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const [pwError, setPwError] = useState<string | null>(null);
  const [resendCooldown, setResendCooldown] = useState(0);

  useEffect(() => {
    if (resendCooldown <= 0) return;
    const t = setInterval(() => setResendCooldown(p => Math.max(0, p - 1)), 1000);
    return () => clearInterval(t);
  }, [resendCooldown]);

  const pwStrength = (() => {
    if (!newPw) return null;
    let s = 0;
    if (newPw.length >= 8) s++;
    if (/[A-Z]/.test(newPw)) s++;
    if (/[0-9]/.test(newPw)) s++;
    if (/[^A-Za-z0-9]/.test(newPw)) s++;
    return s;
  })();

  async function handleSave() {
    setSaving(true);
    setSaveError(null);
    try {
      const { error } = await supabase
      .from("account")
      .update({ username, login })
      .eq("id", profileUser.id);
      if (error) throw error;
      onSave({ username, login });
    } catch (e: any) {
      setSaveError(e?.message ?? "Помилка збереження");
    } finally {
      setSaving(false);
    }
  }

  async function sendCode() {
    setPwError(null);
    setPwStep("sending");
    try {
      const { error } = await supabase.auth.signInWithOtp({
        email: profileUser.email,
        options: { shouldCreateUser: false },
      });
      if (error) throw error;
      setPwStep("code");
      setResendCooldown(60);
    } catch (e: any) {
      setPwError(e?.message ?? "Помилка відправки коду");
      setPwStep("idle");
    }
  }

  async function verifyCode() {
    if (code.length !== 6) return setPwError("Введіть 6-значний код");
    setPwError(null);
    setPwStep("verifying");
    try {
      const { error } = await supabase.auth.verifyOtp({
        email: profileUser.email,
        token: code,
        type: "email",
      });
      if (error) throw error;
      setPwStep("newpw");
    } catch {
      setPwError("Невірний або застарілий код. Спробуйте ще раз.");
      setPwStep("code");
    }
  }

  async function setPassword() {
    if (newPw.length < 8) return setPwError("Пароль має містити мінімум 8 символів");
    if (newPw !== confirmPw) return setPwError("Паролі не співпадають");
    setPwError(null);
    setPwStep("verifying");
    try {
      const { error } = await supabase.auth.updateUser({ password: newPw });
      if (error) throw error;
      setPwStep("done");
      setCode(""); setNewPw(""); setConfirmPw("");
    } catch (e: any) {
      setPwError(e?.message ?? "Помилка зміни пароля");
      setPwStep("newpw");
    }
  }

  function resetPw() {
    setPwStep("idle"); setCode(""); setNewPw(""); setConfirmPw(""); setPwError(null);
  }

  const inputClass = "w-full px-5 py-3.5 rounded-xl border border-(--brd) bg-(--bg) text-(--t1) text-sm font-medium focus:ring-2 focus:ring-blue-500/30 focus:border-blue-600 outline-none transition-all";

  return (
    <div className="space-y-6">
    {/* ── Edit fields ── */}
    <div className="space-y-4">
    <h3 className="text-xs font-black uppercase tracking-widest text-(--t2) flex items-center gap-2">
    <Pencil size={12} /> Редагування профілю
    </h3>

    <div className="space-y-3">
    <div className="flex flex-col gap-1.5">
    <label className="text-[10px] font-black text-(--t2) uppercase tracking-widest ml-1">Ім'я</label>
    <input
    type="text"
    value={username}
    onChange={e => setUsername(e.target.value)}
    className={inputClass}
    placeholder="Ваше ім'я"
    />
    </div>
    <div className="flex flex-col gap-1.5">
    <label className="text-[10px] font-black text-(--t2) uppercase tracking-widest ml-1">Логін</label>
    <input
    type="text"
    value={login}
    onChange={e => setLogin(e.target.value)}
    className={inputClass}
    placeholder="Ваш логін"
    />
    </div>
    <div className="flex flex-col gap-1.5">
    <label className="text-[10px] font-black text-(--t2) uppercase tracking-widest ml-1">Email</label>
    <input
    type="text"
    value={profileUser.email}
    disabled
    className={`${inputClass} opacity-50 cursor-not-allowed`}
    />
    </div>
    </div>

    {saveError && (
      <div className="flex items-center gap-2 p-3 rounded-xl bg-red-500/10 border border-red-500/20 text-red-500 text-xs font-bold">
      <AlertCircle size={14} className="flex-shrink-0" /> {saveError}
      </div>
    )}

    <div className="flex gap-3">
    <button
    onClick={handleSave}
    disabled={saving || (!username.trim() || !login.trim())}
    className="flex items-center gap-2 bg-blue-600 text-white font-black text-xs uppercase tracking-widest rounded-2xl px-6 py-3.5 hover:bg-blue-700 active:scale-95 transition-all disabled:opacity-40 shadow-lg shadow-blue-600/20"
    >
    {saving ? <Loader size={14} className="animate-spin" /> : <Save size={14} />}
    {saving ? "Збереження..." : "Зберегти"}
    </button>
    <button
    onClick={onCancel}
    className="flex items-center gap-2 border border-(--brd) text-(--t2) font-black text-xs uppercase tracking-widest rounded-2xl px-5 py-3.5 hover:border-red-500/40 hover:text-red-500 active:scale-95 transition-all"
    >
    <X size={14} /> Скасувати
    </button>
    </div>
    </div>

    {/* ── Divider ── */}
    <div className="border-t border-(--brd)" />

    {/* ── Password change (inline) ── */}
    <div className="space-y-4">
    <h3 className="text-xs font-black uppercase tracking-widest text-(--t2) flex items-center gap-2">
    <KeyRound size={12} /> Зміна пароля
    </h3>

    {pwStep === "idle" && (
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
      <p className="text-xs font-medium text-(--t2)">
      Код підтвердження надійде на <span className="font-black text-(--t1)">{profileUser.email}</span>
      </p>
      <button
      onClick={sendCode}
      className="flex items-center gap-2 border border-(--brd) text-(--t2) font-black text-xs uppercase tracking-widest rounded-2xl px-5 py-3 hover:border-blue-600/40 hover:text-blue-600 active:scale-95 transition-all whitespace-nowrap"
      >
      <KeyRound size={14} /> Змінити пароль
      </button>
      </div>
    )}

    {pwStep === "sending" && (
      <div className="flex items-center gap-3 py-2 text-(--t2)">
      <Loader size={16} className="animate-spin text-blue-600" />
      <span className="text-sm font-bold">Надсилання коду...</span>
      </div>
    )}

    {pwStep === "code" && (
      <div className="space-y-5">
      <div className="text-center">
      <div className="w-12 h-12 rounded-2xl bg-blue-600/10 border border-blue-600/20 flex items-center justify-center mx-auto mb-3">
      <Mail size={20} className="text-blue-600" />
      </div>
      <p className="font-black text-(--t1) text-sm mb-1">Перевірте пошту</p>
      <p className="text-xs text-(--t2) font-medium">Код надіслано на <span className="font-black text-(--t1)">{profileUser.email}</span></p>
      </div>
      <CodeInput value={code} onChange={setCode} />
      {pwError && (
        <div className="flex items-center gap-2 p-3 rounded-xl bg-red-500/10 border border-red-500/20 text-red-500 text-xs font-bold">
        <AlertCircle size={14} className="flex-shrink-0" /> {pwError}
        </div>
      )}
      <div className="flex flex-col sm:flex-row gap-3">
      <button onClick={verifyCode} disabled={code.length !== 6}
      className="flex-1 flex items-center justify-center gap-2 bg-blue-600 text-white font-black text-xs uppercase tracking-widest rounded-2xl px-6 py-3.5 hover:bg-blue-700 active:scale-95 transition-all disabled:opacity-40 shadow-lg shadow-blue-600/20">
      <CheckCircle size={14} /> Підтвердити код
      </button>
      <button onClick={() => { if (resendCooldown === 0) sendCode(); }} disabled={resendCooldown > 0}
      className="flex items-center justify-center gap-2 border border-(--brd) text-(--t2) font-black text-xs uppercase tracking-widest rounded-2xl px-5 py-3.5 hover:border-blue-600/40 hover:text-blue-600 active:scale-95 transition-all disabled:opacity-40">
      <RefreshCw size={14} /> {resendCooldown > 0 ? `(${resendCooldown}с)` : "Ще раз"}
      </button>
      <button onClick={resetPw} className="text-xs font-black uppercase tracking-widest text-(--t2) hover:text-red-500 transition-colors px-2">
      Скасувати
      </button>
      </div>
      </div>
    )}

    {pwStep === "verifying" && (
      <div className="flex items-center gap-3 py-2 text-(--t2)">
      <Loader size={16} className="animate-spin text-blue-600" />
      <span className="text-sm font-bold">Перевірка...</span>
      </div>
    )}

    {pwStep === "newpw" && (
      <div className="space-y-4">
      <div className="flex items-center gap-2 p-3 rounded-xl bg-green-500/10 border border-green-500/20 text-green-600 text-xs font-bold">
      <CheckCircle size={14} className="flex-shrink-0" /> Код підтверджено! Встановіть новий пароль.
      </div>
      <div className="space-y-3">
      <div className="flex flex-col gap-1.5">
      <label className="text-[10px] font-black text-(--t2) uppercase tracking-widest ml-1">Новий пароль</label>
      <div className="relative">
      <input
      type={showPw ? "text" : "password"}
      value={newPw}
      onChange={e => setNewPw(e.target.value)}
      placeholder="Мінімум 8 символів..."
      className="w-full px-5 py-3.5 pr-12 rounded-xl border border-(--brd) bg-(--bg) text-(--t1) text-sm font-medium focus:ring-2 focus:ring-blue-500/30 focus:border-blue-600 outline-none transition-all"
      />
      <button type="button" onClick={() => setShowPw(p => !p)}
      className="absolute right-4 top-1/2 -translate-y-1/2 text-(--t2) hover:text-blue-600 transition-colors">
      {showPw ? <EyeOff size={16} /> : <Eye size={16} />}
      </button>
      </div>
      {newPw && pwStrength !== null && (
        <div className="space-y-1">
        <div className="flex gap-1">
        {[1, 2, 3, 4].map(i => (
          <div key={i} className={`h-1 flex-1 rounded-full transition-all duration-300 ${
            i <= pwStrength
            ? pwStrength <= 1 ? "bg-red-500" : pwStrength === 2 ? "bg-amber-500" : pwStrength === 3 ? "bg-blue-500" : "bg-green-500"
            : "bg-(--brd)"
          }`} />
        ))}
        </div>
        <p className="text-[10px] font-bold text-(--t2)">
        {pwStrength <= 1 ? "Слабкий" : pwStrength === 2 ? "Середній" : pwStrength === 3 ? "Хороший" : "Надійний"}
        </p>
        </div>
      )}
      </div>
      <div className="flex flex-col gap-1.5">
      <label className="text-[10px] font-black text-(--t2) uppercase tracking-widest ml-1">Підтвердіть пароль</label>
      <div className="relative">
      <input
      type={showConfirm ? "text" : "password"}
      value={confirmPw}
      onChange={e => setConfirmPw(e.target.value)}
      placeholder="Повторіть пароль..."
      className={`w-full px-5 py-3.5 pr-12 rounded-xl border bg-(--bg) text-(--t1) text-sm font-medium focus:ring-2 outline-none transition-all ${
        confirmPw && confirmPw !== newPw ? "border-red-500 focus:ring-red-500/20"
        : confirmPw && confirmPw === newPw ? "border-green-500 focus:ring-green-500/20"
        : "border-(--brd) focus:ring-blue-500/30 focus:border-blue-600"
      }`}
      />
      <button type="button" onClick={() => setShowConfirm(p => !p)}
      className="absolute right-4 top-1/2 -translate-y-1/2 text-(--t2) hover:text-blue-600 transition-colors">
      {showConfirm ? <EyeOff size={16} /> : <Eye size={16} />}
      </button>
      {confirmPw && confirmPw === newPw && (
        <CheckCircle size={16} className="absolute right-12 top-1/2 -translate-y-1/2 text-green-500" />
      )}
      </div>
      </div>
      </div>
      {pwError && (
        <div className="flex items-center gap-2 p-3 rounded-xl bg-red-500/10 border border-red-500/20 text-red-500 text-xs font-bold">
        <AlertCircle size={14} className="flex-shrink-0" /> {pwError}
        </div>
      )}
      <div className="flex gap-3">
      <button onClick={setPassword} disabled={!newPw || !confirmPw}
      className="flex-1 flex items-center justify-center gap-2 bg-blue-600 text-white font-black text-xs uppercase tracking-widest rounded-2xl px-6 py-4 hover:bg-blue-700 active:scale-95 transition-all disabled:opacity-40 shadow-lg shadow-blue-600/20">
      <Lock size={14} /> Встановити пароль
      </button>
      <button onClick={resetPw} className="text-xs font-black uppercase tracking-widest text-(--t2) hover:text-red-500 transition-colors px-2">
      Скасувати
      </button>
      </div>
      </div>
    )}

    {pwStep === "done" && (
      <div className="space-y-3">
      <div className="flex flex-col items-center text-center py-4 gap-3">
      <div className="w-12 h-12 rounded-2xl bg-green-500/10 border border-green-500/20 flex items-center justify-center">
      <CheckCircle size={24} className="text-green-500" />
      </div>
      <div>
      <p className="font-black text-(--t1) text-sm">Пароль успішно змінено!</p>
      <p className="text-xs text-(--t2) font-medium mt-1">Використовуйте новий пароль при наступному вході</p>
      </div>
      </div>
      <button onClick={resetPw}
      className="w-full border border-(--brd) text-(--t2) font-black text-xs uppercase tracking-widest rounded-2xl px-6 py-3 hover:border-blue-600/40 hover:text-blue-600 active:scale-95 transition-all">
      Закрити
      </button>
      </div>
    )}
    </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Main page
// ─────────────────────────────────────────────────────────────────────────────
export default function ProfilePage() {
  const [isMobileSidebarOpen, setIsMobileSidebarOpen] = useState(false);
  const { dark } = useTheme();
  const router = useRouter();
  const { user: currentUser, token, isLoading: authLoading } = useAuth();

  const [profileUser, setProfileUser] = useState<any>(null);
  const [isLoading, setIsLoading]     = useState(true);
  const [error, setError]             = useState<string | null>(null);
  const [isEditing, setIsEditing]     = useState(false);

  const [selectedRole, setSelectedRole]     = useState<Role>("user");
  const [isChangingRole, setIsChangingRole] = useState(false);
  const [roleMsg, setRoleMsg]               = useState<{ type: "ok" | "err"; text: string } | null>(null);

  const isSuperAdmin = currentUser?.role === "superadmin";
  const { teams: userTeams, loading: teamsLoading } = useUserTeams(currentUser?.id);

  useEffect(() => {
    if (authLoading) return;
    if (!currentUser) { router.push("/login"); return; }

    const fetchUser = async () => {
      setIsLoading(true);
      try {
        const { data, error } = await supabase
        .from("account")
        .select("id, username, login, email, role, status, avatar_url")
        .eq("id", currentUser.id)
        .single();
        if (error) throw error;
        setProfileUser(data);
        setSelectedRole((data.role as Role) ?? "user");
      } catch {
        setError("Користувача не знайдено");
      } finally {
        setIsLoading(false);
      }
    };
    fetchUser();
  }, [authLoading, currentUser, router]);

  const handleRoleChange = async () => {
    if (!isSuperAdmin || !profileUser) return;
    setIsChangingRole(true);
    setRoleMsg(null);
    try {
      const freshToken = (typeof window !== "undefined" && localStorage.getItem("access_token")) || token;
      if (!freshToken) throw new Error("Токен авторизації не знайдено. Увійдіть знову.");
      const expiry = (() => {
        try { const p = JSON.parse(atob(freshToken.split(".")[1])); return (p.exp ?? 0) * 1000; } catch { return 0; }
      })();
      if (expiry < Date.now()) throw new Error("Сесія закінчилась. Увійдіть знову.");
      const res = await fetch(`${API_URL}/api/change-role`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${freshToken}` },
        body: JSON.stringify({ target_user_id: profileUser.id, new_role: selectedRole }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.detail ?? `Помилка сервера: ${res.status}`);
      setProfileUser((prev: any) => ({ ...prev, role: selectedRole }));
      setRoleMsg({ type: "ok", text: `Роль змінено на ${selectedRole}` });
    } catch (e: any) {
      setRoleMsg({ type: "err", text: e.message });
    } finally {
      setIsChangingRole(false);
    }
  };

  // ── Shared layout ──────────────────────────────────────────────────────────
  const Layout = ({ children }: { children: React.ReactNode }) => (
    <div className="flex h-screen overflow-hidden bg-(--bg) text-(--t1) transition-colors duration-300">
    <style jsx global>{`
      @keyframes fadeUp { from{opacity:0;transform:translateY(18px)} to{opacity:1;transform:none} }
      .fade-up   { animation: fadeUp 380ms cubic-bezier(.22,1,.36,1) both }
      .fade-up-1 { animation: fadeUp 380ms cubic-bezier(.22,1,.36,1) 60ms both }
      .fade-up-2 { animation: fadeUp 380ms cubic-bezier(.22,1,.36,1) 120ms both }
      .fade-up-3 { animation: fadeUp 380ms cubic-bezier(.22,1,.36,1) 180ms both }
      `}</style>
      <div className={`fixed inset-0 flex items-center justify-center pointer-events-none z-0 ${dark ? "opacity-10" : "opacity-5"}`}>
      <img src="/logo_background1.png" alt="" className={`w-[min(800px,90vw)] h-[min(800px,90vw)] object-contain blur-sm ${dark ? "invert" : ""}`} />
      </div>
      {isMobileSidebarOpen && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-40 lg:hidden" onClick={() => setIsMobileSidebarOpen(false)} />
      )}
      <div className={`fixed inset-y-0 left-0 z-50 lg:relative lg:translate-x-0 transition-transform duration-300 ease-in-out ${isMobileSidebarOpen ? "translate-x-0" : "-translate-x-full lg:translate-x-0"}`}>
      <Sidebar />
      </div>
      <main className="flex-1 flex flex-col min-w-0 overflow-hidden">
      <MobileHeader onOpenSidebar={() => setIsMobileSidebarOpen(true)} title="Профіль" icon={<UserCircle size={18} className="text-blue-600" />} />
      {children}
      </main>
      </div>
  );

  if (authLoading) return (
    <div className="min-h-screen bg-(--bg) flex items-center justify-center">
    <div className="w-8 h-8 border-2 border-blue-600 border-t-transparent rounded-full animate-spin" />
    </div>
  );

  if (isLoading) return (
    <Layout>
    <div className="flex-1 flex items-center justify-center">
    <div className="w-8 h-8 border-2 border-blue-600 border-t-transparent rounded-full animate-spin" />
    </div>
    </Layout>
  );

  if (!currentUser) return null;

  return (
    <Layout>
    <div className="flex-1 overflow-y-auto p-4 sm:p-6 md:p-8 lg:p-12 relative z-10">

    {/* Breadcrumb */}
    <nav className="flex items-center gap-2 text-[10px] font-black mb-6 uppercase tracking-widest text-(--t2)">
    <button onClick={() => router.push("/")} className="hover:text-blue-600 transition-colors">Головна</button>
    <ChevronRight size={10} />
    <span className="text-(--t1)">Профіль</span>
    </nav>

    <button onClick={() => router.back()} className="mb-6 flex items-center gap-2 text-[11px] font-black uppercase tracking-widest text-(--t2) hover:text-blue-600 transition-colors">
    <ArrowLeft size={14} /> Назад
    </button>

    {error ? (
      <div className="max-w-2xl mx-auto bg-(--card) rounded-2xl sm:rounded-[2.5rem] border border-(--brd) p-12 text-center">
      <p className="text-lg font-black text-(--t1) mb-2">{error}</p>
      <p className="text-(--t2) text-sm">Користувача не знайдено</p>
      </div>
    ) : profileUser ? (
      <div className="max-w-2xl mx-auto space-y-6">

      {/* ── Profile card ── */}
      <section className="fade-up bg-(--card) rounded-2xl sm:rounded-[2.5rem] shadow-sm border border-(--brd) p-6 sm:p-8 relative overflow-hidden">
      <div className="absolute right-0 top-0 opacity-5 pointer-events-none text-(--t1) hidden md:block">
      <Shield size={240} />
      </div>

      {isEditing ? (
        <EditProfileSection
        profileUser={profileUser}
        onSave={(updated) => {
          setProfileUser((prev: any) => ({ ...prev, ...updated }));
          setIsEditing(false);
        }}
        onCancel={() => setIsEditing(false)}
        />
      ) : (
        <>
        <div className="flex flex-col sm:flex-row items-center gap-6 sm:gap-8">
        {/* Avatar */}
        <div className="relative flex-shrink-0">
        <div className="w-24 h-24 sm:w-28 sm:h-28 rounded-full bg-blue-600/10 flex items-center justify-center border-4 border-(--brd) shadow-md">
        {profileUser.avatar_url
          ? <img src={profileUser.avatar_url} alt="avatar" className="w-full h-full object-cover rounded-full" />
          : <span className="text-4xl font-black text-blue-600">{profileUser.username?.charAt(0).toUpperCase() ?? "?"}</span>
        }
        </div>
        {profileUser.status === "active" && (
          <span className="absolute bottom-1 right-1 w-5 h-5 bg-green-500 border-4 border-(--card) rounded-full shadow-sm" />
        )}
        </div>

        <div className="flex-1 space-y-3 z-10 w-full text-center sm:text-left">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
        <h1 className="text-2xl font-black text-(--t1) uppercase tracking-tight">{profileUser.username}</h1>
        <button
        onClick={() => setIsEditing(true)}
        className="flex items-center gap-2 self-center sm:self-auto border border-(--brd) text-(--t2) font-black text-[10px] uppercase tracking-widest rounded-xl px-4 py-2 hover:border-blue-600/40 hover:text-blue-600 active:scale-95 transition-all"
        >
        <Pencil size={12} /> Редагувати
        </button>
        </div>

        <div className="flex items-center gap-2 justify-center sm:justify-start flex-wrap">
        <span className="text-[9px] font-black uppercase bg-blue-500/10 text-blue-500 border border-blue-500/20 px-2.5 py-1 rounded-lg">
        Ваш профіль
        </span>
        <span className={`text-[9px] font-black uppercase px-2.5 py-1 rounded-lg border ${roleBadgeColor[profileUser.role as Role] ?? roleBadgeColor.user}`}>
        {profileUser.role ?? "user"}
        </span>
        </div>

        <div className="mt-4 space-y-2.5 text-sm text-left">
        <p className="flex items-center gap-3 font-medium">
        <User size={16} className="text-blue-600 flex-shrink-0" />
        <span className="text-(--t2)">Ім'я:</span>
        <span className="font-bold">{profileUser.username}</span>
        </p>
        <p className="flex items-center gap-3 font-medium">
        <User size={16} className="text-blue-600 flex-shrink-0" />
        <span className="text-(--t2)">Логін:</span>
        <span className="font-bold">{profileUser.login}</span>
        </p>
        <p className="flex items-center gap-3 font-medium">
        <Mail size={16} className="text-blue-600 flex-shrink-0" />
        <span className="text-(--t2)">Email:</span>
        <span className="font-bold break-all">{profileUser.email}</span>
        </p>
        <p className="flex items-center gap-3 font-medium">
        <Shield size={16} className="text-blue-600 flex-shrink-0" />
        <span className="text-(--t2)">Роль:</span>
        <span className={`text-[10px] font-black uppercase px-2.5 py-1 rounded-lg border ${roleBadgeColor[profileUser.role as Role] ?? roleBadgeColor.user}`}>
        {profileUser.role ?? "user"}
        </span>
        </p>
        </div>

        <div className="pt-3 border-t border-(--brd) text-[9px] font-bold uppercase tracking-widest text-(--t2)">
        ID: {profileUser.id}
        </div>
        </div>
        </div>
        </>
      )}
      </section>

      {/* ── Teams ── */}
      <section className="fade-up-1 bg-(--card) rounded-2xl sm:rounded-[2.5rem] shadow-sm border border-(--brd) overflow-hidden">
      <div className="flex items-center gap-3 px-6 sm:px-8 py-4 border-b border-(--brd) bg-(--bg)/40">
      <div className="w-8 h-8 rounded-xl bg-blue-600/10 text-blue-600 flex items-center justify-center flex-shrink-0">
      <Users size={16} />
      </div>
      <div>
      <p className="text-xs font-black uppercase tracking-widest text-(--t1)">Команди</p>
      {!teamsLoading && userTeams.length > 0 && (
        <p className="text-[10px] font-bold text-(--t2) mt-0.5">{userTeams.length} команд</p>
      )}
      </div>
      </div>
      <div className="p-6 sm:p-8">
      {teamsLoading ? (
        <div className="flex items-center gap-2 text-(--t2) py-2">
        <Loader size={14} className="animate-spin" />
        <span className="text-[11px] font-bold uppercase tracking-wider">Завантаження...</span>
        </div>
      ) : userTeams.length === 0 ? (
        <div className="text-center py-6">
        <div className="w-12 h-12 rounded-2xl bg-(--bg) border border-(--brd) flex items-center justify-center mx-auto mb-3">
        <Users className="w-6 h-6 text-(--t2) opacity-40" />
        </div>
        <p className="text-[11px] font-bold text-(--t2) uppercase tracking-wider">Не перебуває в жодній команді</p>
        <button onClick={() => router.push("/register_team")} className="mt-4 text-[10px] font-black uppercase tracking-widest text-blue-600 hover:underline">
        Створити команду →
        </button>
        </div>
      ) : (
        <div className="space-y-2">
        {userTeams.map(team => {
          const isCaptain = team.captain_id === profileUser.id;
          const memberCount = team.members_ids?.length ?? 0;
          return (
            <button
            key={team.id}
            type="button"
            onClick={() => router.push(`/teams/${team.id}`)}
            className="w-full flex items-center gap-4 p-4 rounded-2xl border border-(--brd) bg-(--bg) hover:border-blue-600/40 hover:bg-blue-600/5 transition-all group text-left"
            >
            <div className="w-10 h-10 rounded-xl bg-blue-600/10 border border-blue-600/20 flex items-center justify-center text-blue-600 font-black text-base flex-shrink-0">
            {team.name.charAt(0).toUpperCase()}
            </div>
            <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
            <span className="font-black text-(--t1) text-sm truncate group-hover:text-blue-600 transition-colors">{team.name}</span>
            {isCaptain && (
              <span className="text-[8px] font-black uppercase bg-amber-500/10 text-amber-500 border border-amber-500/20 px-2 py-0.5 rounded-md flex-shrink-0 flex items-center gap-1">
              <Crown size={8} /> Капітан
              </span>
            )}
            </div>
            <div className="flex items-center gap-3 mt-0.5">
            {team.city_school_org && <span className="text-[10px] font-bold text-(--t2) truncate">{team.city_school_org}</span>}
            <span className="text-[10px] font-bold text-(--t2) flex items-center gap-1 flex-shrink-0">
            <Users size={9} /> {memberCount} уч.
            </span>
            </div>
            </div>
            <ExternalLink size={14} className="text-(--t2) flex-shrink-0 opacity-0 group-hover:opacity-100 transition-opacity" />
            </button>
          );
        })}
        </div>
      )}
      </div>
      </section>
      </div>
    ) : null}
    </div>
    </Layout>
  );
}
