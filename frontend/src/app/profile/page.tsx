//site_turing_CrutchMasters_team-s/frontend/src/app/profile/page.tsx
"use client";

import React, { useState, useEffect, useRef, useCallback } from "react";
import { useRouter } from "next/navigation";
import {
  User, Mail, Shield, ChevronRight, UserCircle, ArrowLeft, Loader,
  Users, Crown, ExternalLink, Lock, Eye, EyeOff, KeyRound,
  CheckCircle, AlertCircle, RefreshCw, Pencil, X, Save,
  Bell, Check, CheckCheck, UserPlus, Trophy, Medal,
} from "lucide-react";
import AvatarEditorModal from "@/components/AvatarEditorModal";
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

// ── Types ─────────────────────────────────────────────────────────────────────

interface UserTeam {
  id: string;
  name: string;
  city_school_org?: string;
  captain_id?: string;
  members_ids?: string[];
}

interface NotifMeta {
  invitation_id?: string;
  team_id?: string;
  team_name?: string;
  inviter_id?: string;
  inviter_name?: string;
  new_member?: string;
}

interface Notification {
  id: string;
  type: string;
  title: string;
  message: string;
  meta: string | NotifMeta | null;
  read: boolean;
  created_at: string;
}

interface Tournament {
  id: string;
  name: string;
  status?: string;
  start_date?: string;
  end_date?: string;
  game?: string;
  team_name?: string;
  place?: number | null;
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function parseMeta(raw: string | NotifMeta | null): NotifMeta {
  if (!raw) return {};
  if (typeof raw === "object") return raw;
  try { return JSON.parse(raw); } catch { return {}; }
}

function timeAgo(iso: string): string {
  try {
    const diff = Math.floor((Date.now() - new Date(iso).getTime()) / 1000);
    if (diff < 60) return `${diff}с тому`;
    if (diff < 3600) return `${Math.floor(diff / 60)}хв тому`;
    if (diff < 86400) return `${Math.floor(diff / 3600)}год тому`;
    return new Date(iso).toLocaleDateString("uk-UA", { day: "numeric", month: "short", year: "numeric" });
  } catch { return ""; }
}

const typeIcon: Record<string, React.ReactNode> = {
  team_invitation:     <UserPlus size={14} className="text-blue-500" />,
  invitation_accepted: <Check    size={14} className="text-green-500" />,
  invitation_declined: <X        size={14} className="text-red-500" />,
};

const typeBorder: Record<string, string> = {
  team_invitation:     "border-l-blue-500",
  invitation_accepted: "border-l-green-500",
  invitation_declined: "border-l-red-500",
};

const tourStatusStyle: Record<string, string> = {
  active:   "text-green-500 bg-green-500/10 border-green-500/20",
  ongoing:  "text-green-500 bg-green-500/10 border-green-500/20",
  upcoming: "text-blue-500 bg-blue-500/10 border-blue-500/20",
  finished: "text-(--t2) bg-(--bg) border-(--brd)",
};

const tourStatusLabel: Record<string, string> = {
  active: "Активний", ongoing: "Активний",
  upcoming: "Очікується", finished: "Завершено",
};

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
  const slots: string[] = Array.from({ length: 6 }, (_, i) => {
    const ch = value[i];
    return ch && /\d/.test(ch) ? ch : "";
  });

  const handleChange = (i: number, v: string) => {
    const d = v.replace(/\D/g, "").slice(-1);
    const next = slots.map((c, idx) => (idx === i ? d : c)).join("");
    onChange(next);
    if (d && i < 5) setTimeout(() => inputs.current[i + 1]?.focus(), 0);
  };

    const handleKeyDown = (i: number, e: React.KeyboardEvent) => {
      if (e.key === "Backspace") {
        if (slots[i]) {
          const next = slots.map((c, idx) => (idx === i ? "" : c)).join("");
          onChange(next);
        } else if (i > 0) {
          inputs.current[i - 1]?.focus();
          const next = slots.map((c, idx) => (idx === i - 1 ? "" : c)).join("");
          onChange(next);
        }
      }
      if (e.key === "ArrowLeft" && i > 0) inputs.current[i - 1]?.focus();
      if (e.key === "ArrowRight" && i < 5) inputs.current[i + 1]?.focus();
    };

      const handlePaste = (e: React.ClipboardEvent) => {
        e.preventDefault();
        const pasted = e.clipboardData.getData("text").replace(/\D/g, "").slice(0, 6);
        onChange(pasted);
        const focusIdx = Math.min(pasted.length, 5);
        setTimeout(() => inputs.current[focusIdx]?.focus(), 0);
      };

      return (
        <div className="flex gap-2 justify-center">
        {slots.map((digit, i) => (
          <input
          key={i}
          ref={el => { inputs.current[i] = el; }}
          type="text"
          inputMode="numeric"
          maxLength={1}
          value={digit}
          onChange={e => handleChange(i, e.target.value)}
          onKeyDown={e => handleKeyDown(i, e)}
          onPaste={handlePaste}
          disabled={disabled}
          className={`w-11 h-14 text-center text-2xl font-black rounded-xl border-2 outline-none transition-all duration-150 disabled:opacity-40 ${
            digit
            ? "border-blue-600 bg-blue-600/10 text-blue-600 shadow-md shadow-blue-600/25"
            : "border-(--brd) bg-(--bg) text-(--t1) focus:border-blue-500 focus:bg-blue-500/5"
          }`}
          />
        ))}
        </div>
      );
}

// ── Edit Profile + Password Change ────────────────────────────────────────────

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
    setSaving(true); setSaveError(null);
    try {
      const { error } = await supabase.from("account").update({ username, login }).eq("id", profileUser.id);
      if (error) throw error;
      onSave({ username, login });
    } catch (e: any) {
      setSaveError(e?.message ?? "Помилка збереження");
    } finally {
      setSaving(false);
    }
  }

  async function sendCode() {
    setPwError(null); setPwStep("sending");
    try {
      const { error } = await supabase.auth.signInWithOtp({
        email: profileUser.email,
        options: { shouldCreateUser: false },
      });
      if (error) throw error;
      setPwStep("code"); setResendCooldown(60);
    } catch (e: any) {
      setPwError(e?.message ?? "Помилка відправки коду"); setPwStep("idle");
    }
  }

  async function verifyCode() {
    if (!/^\d{6}$/.test(code)) return setPwError("Введіть 6-значний код");
    setPwError(null); setPwStep("verifying");
    try {
      const { error } = await supabase.auth.verifyOtp({ email: profileUser.email, token: code, type: "email" });
      if (error) throw error;
      setPwStep("newpw");
    } catch {
      setPwError("Невірний або застарілий код. Спробуйте ще раз."); setPwStep("code");
    }
  }

  async function setPassword() {
    if (newPw.length < 8) return setPwError("Пароль має містити мінімум 8 символів");
    if (newPw !== confirmPw) return setPwError("Паролі не співпадають");
    setPwError(null); setPwStep("verifying");
    try {
      const { error } = await supabase.auth.updateUser({ password: newPw });
      if (error) throw error;
      setPwStep("done"); setCode(""); setNewPw(""); setConfirmPw("");
    } catch (e: any) {
      setPwError(e?.message ?? "Помилка зміни пароля"); setPwStep("newpw");
    }
  }

  function resetPw() { setPwStep("idle"); setCode(""); setNewPw(""); setConfirmPw(""); setPwError(null); }

  const inputClass = "w-full px-4 py-3 rounded-xl border border-(--brd) bg-(--bg) text-(--t1) text-sm font-medium focus:ring-2 focus:ring-blue-500/30 focus:border-blue-600 outline-none transition-all";
  const codeIsValid = /^\d{6}$/.test(code);

  return (
    <div className="space-y-5">
    {/* Edit fields */}
    <div className="space-y-3">
    <h3 className="text-xs font-black uppercase tracking-widest text-(--t2) flex items-center gap-2">
    <Pencil size={12} /> Редагування профілю
    </h3>
    <div className="flex flex-col gap-1.5">
    <label className="text-[10px] font-black text-(--t2) uppercase tracking-widest ml-1">Ім'я</label>
    <input type="text" value={username} onChange={e => setUsername(e.target.value)} className={inputClass} placeholder="Ваше ім'я" />
    </div>
    <div className="flex flex-col gap-1.5">
    <label className="text-[10px] font-black text-(--t2) uppercase tracking-widest ml-1">Логін</label>
    <input type="text" value={login} onChange={e => setLogin(e.target.value)} className={inputClass} placeholder="Ваш логін" />
    </div>
    <div className="flex flex-col gap-1.5">
    <label className="text-[10px] font-black text-(--t2) uppercase tracking-widest ml-1">Email</label>
    <input type="text" value={profileUser.email} disabled className={`${inputClass} opacity-50 cursor-not-allowed`} />
    </div>
    {saveError && (
      <div className="flex items-center gap-2 p-3 rounded-xl bg-red-500/10 border border-red-500/20 text-red-500 text-xs font-bold">
      <AlertCircle size={14} className="flex-shrink-0" /> {saveError}
      </div>
    )}
    <div className="flex gap-2">
    <button onClick={handleSave} disabled={saving || !username.trim() || !login.trim()}
    className="flex items-center gap-2 bg-blue-600 text-white font-black text-xs uppercase tracking-widest rounded-xl px-5 py-3 hover:bg-blue-700 active:scale-95 transition-all disabled:opacity-40 shadow-lg shadow-blue-600/20">
    {saving ? <Loader size={13} className="animate-spin" /> : <Save size={13} />}
    {saving ? "Збереження..." : "Зберегти"}
    </button>
    <button onClick={onCancel}
    className="flex items-center gap-2 border border-(--brd) text-(--t2) font-black text-xs uppercase tracking-widest rounded-xl px-4 py-3 hover:border-red-500/40 hover:text-red-500 active:scale-95 transition-all">
    <X size={13} /> Скасувати
    </button>
    </div>
    </div>

    <div className="border-t border-(--brd)" />

    {/* Password change */}
    <div className="space-y-3">
    <h3 className="text-xs font-black uppercase tracking-widest text-(--t2) flex items-center gap-2">
    <KeyRound size={12} /> Зміна пароля
    </h3>

    {pwStep === "idle" && (
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
      <p className="text-xs font-medium text-(--t2)">
      Код надійде на <span className="font-black text-(--t1)">{profileUser.email}</span>
      </p>
      <button onClick={sendCode}
      className="flex items-center gap-2 border border-(--brd) text-(--t2) font-black text-xs uppercase tracking-widest rounded-xl px-4 py-2.5 hover:border-blue-600/40 hover:text-blue-600 active:scale-95 transition-all whitespace-nowrap">
      <KeyRound size={13} /> Змінити пароль
      </button>
      </div>
    )}

    {pwStep === "sending" && (
      <div className="flex items-center gap-3 py-2 text-(--t2)">
      <Loader size={15} className="animate-spin text-blue-600" />
      <span className="text-sm font-bold">Надсилання коду на пошту...</span>
      </div>
    )}

    {pwStep === "code" && (
      <div className="space-y-4">
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
        <AlertCircle size={13} className="flex-shrink-0" /> {pwError}
        </div>
      )}
      <div className="flex flex-col sm:flex-row gap-2">
      <button onClick={verifyCode} disabled={!codeIsValid}
      className={`flex-1 flex items-center justify-center gap-2 font-black text-xs uppercase tracking-widest rounded-xl px-5 py-3 active:scale-95 transition-all shadow-lg ${
        codeIsValid
        ? "bg-blue-600 text-white hover:bg-blue-700 shadow-blue-600/20"
        : "bg-(--brd) text-(--t2) cursor-not-allowed opacity-50 shadow-none"
      }`}>
      <CheckCircle size={13} /> Підтвердити
      </button>
      <button onClick={() => { if (resendCooldown === 0) sendCode(); }} disabled={resendCooldown > 0}
      className="flex items-center justify-center gap-2 border border-(--brd) text-(--t2) font-black text-xs uppercase tracking-widest rounded-xl px-4 py-3 hover:border-blue-600/40 hover:text-blue-600 active:scale-95 transition-all disabled:opacity-40">
      <RefreshCw size={13} /> {resendCooldown > 0 ? `(${resendCooldown}с)` : "Ще раз"}
      </button>
      <button onClick={resetPw} className="text-xs font-black uppercase tracking-widest text-(--t2) hover:text-red-500 transition-colors px-2">
      Скасувати
      </button>
      </div>
      </div>
    )}

    {pwStep === "verifying" && (
      <div className="flex items-center gap-3 py-2 text-(--t2)">
      <Loader size={15} className="animate-spin text-blue-600" />
      <span className="text-sm font-bold">Перевірка...</span>
      </div>
    )}

    {pwStep === "newpw" && (
      <div className="space-y-3">
      <div className="flex items-center gap-2 p-3 rounded-xl bg-green-500/10 border border-green-500/20 text-green-600 text-xs font-bold">
      <CheckCircle size={13} className="flex-shrink-0" /> Код підтверджено! Встановіть новий пароль.
      </div>
      <div className="flex flex-col gap-1.5">
      <label className="text-[10px] font-black text-(--t2) uppercase tracking-widest ml-1">Новий пароль</label>
      <div className="relative">
      <input type={showPw ? "text" : "password"} value={newPw} onChange={e => setNewPw(e.target.value)}
      placeholder="Мінімум 8 символів..."
      className="w-full px-4 py-3 pr-11 rounded-xl border border-(--brd) bg-(--bg) text-(--t1) text-sm font-medium focus:ring-2 focus:ring-blue-500/30 focus:border-blue-600 outline-none transition-all" />
      <button type="button" onClick={() => setShowPw(p => !p)}
      className="absolute right-3 top-1/2 -translate-y-1/2 text-(--t2) hover:text-blue-600 transition-colors">
      {showPw ? <EyeOff size={15} /> : <Eye size={15} />}
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
      <input type={showConfirm ? "text" : "password"} value={confirmPw} onChange={e => setConfirmPw(e.target.value)}
      placeholder="Повторіть пароль..."
      className={`w-full px-4 py-3 pr-11 rounded-xl border bg-(--bg) text-(--t1) text-sm font-medium focus:ring-2 outline-none transition-all ${
        confirmPw && confirmPw !== newPw ? "border-red-500 focus:ring-red-500/20"
        : confirmPw && confirmPw === newPw ? "border-green-500 focus:ring-green-500/20"
        : "border-(--brd) focus:ring-blue-500/30 focus:border-blue-600"
      }`} />
      <button type="button" onClick={() => setShowConfirm(p => !p)}
      className="absolute right-3 top-1/2 -translate-y-1/2 text-(--t2) hover:text-blue-600 transition-colors">
      {showConfirm ? <EyeOff size={15} /> : <Eye size={15} />}
      </button>
      {confirmPw && confirmPw === newPw && (
        <CheckCircle size={14} className="absolute right-10 top-1/2 -translate-y-1/2 text-green-500" />
      )}
      </div>
      </div>
      {pwError && (
        <div className="flex items-center gap-2 p-3 rounded-xl bg-red-500/10 border border-red-500/20 text-red-500 text-xs font-bold">
        <AlertCircle size={13} className="flex-shrink-0" /> {pwError}
        </div>
      )}
      <div className="flex gap-2">
      <button onClick={setPassword} disabled={!newPw || !confirmPw || newPw !== confirmPw || newPw.length < 8}
      className={`flex-1 flex items-center justify-center gap-2 font-black text-xs uppercase tracking-widest rounded-xl px-5 py-3 active:scale-95 transition-all shadow-lg ${
        newPw && confirmPw && newPw === confirmPw && newPw.length >= 8
        ? "bg-blue-600 text-white hover:bg-blue-700 shadow-blue-600/20"
        : "bg-(--brd) text-(--t2) cursor-not-allowed opacity-50 shadow-none"
      }`}>
      <Lock size={13} /> Встановити пароль
      </button>
      <button onClick={resetPw} className="text-xs font-black uppercase tracking-widest text-(--t2) hover:text-red-500 transition-colors px-2">
      Скасувати
      </button>
      </div>
      </div>
    )}

    {pwStep === "done" && (
      <div className="space-y-3">
      <div className="flex flex-col items-center text-center py-3 gap-2">
      <div className="w-11 h-11 rounded-2xl bg-green-500/10 border border-green-500/20 flex items-center justify-center">
      <CheckCircle size={22} className="text-green-500" />
      </div>
      <div>
      <p className="font-black text-(--t1) text-sm">Пароль успішно змінено!</p>
      <p className="text-xs text-(--t2) font-medium mt-0.5">Використовуйте новий пароль при наступному вході</p>
      </div>
      </div>
      <button onClick={resetPw}
      className="w-full border border-(--brd) text-(--t2) font-black text-xs uppercase tracking-widest rounded-xl px-5 py-3 hover:border-blue-600/40 hover:text-blue-600 active:scale-95 transition-all">
      Закрити
      </button>
      </div>
    )}
    </div>
    </div>
  );
}

// ── Notification card ─────────────────────────────────────────────────────────

function NotificationCard({
  notif, idx, responded, responding,
  onAccept, onDecline, onMarkRead, onGoTeam,
}: {
  notif: Notification;
  idx: number;
  responded: "accepted" | "declined" | undefined;
  responding: "accept" | "decline" | null;
  onAccept: () => void;
  onDecline: () => void;
  onMarkRead: () => void;
  onGoTeam: (id: string) => void;
}) {
  const meta = parseMeta(notif.meta);
  const isInvite = notif.type === "team_invitation";
  const borderClass = typeBorder[notif.type] ?? "border-l-gray-400";

  return (
    <div
    className={`fuIn bg-(--bg) rounded-xl border border-(--brd) border-l-4 ${borderClass} p-3.5 transition-all ${!notif.read ? "shadow-sm" : "opacity-60"}`}
    style={{ animationDelay: `${idx * 40}ms` }}
    >
    <div className="flex items-start gap-3">
    <div className={`w-7 h-7 rounded-lg flex items-center justify-center flex-shrink-0 ${
      notif.type === "team_invitation"     ? "bg-blue-500/10 border border-blue-500/20" :
      notif.type === "invitation_accepted" ? "bg-green-500/10 border border-green-500/20" :
      notif.type === "invitation_declined" ? "bg-red-500/10 border border-red-500/20" :
      "bg-(--card) border border-(--brd)"
    }`}>
    {typeIcon[notif.type] ?? <Bell size={13} className="text-(--t2)" />}
    </div>

    <div className="flex-1 min-w-0">
    <div className="flex items-start justify-between gap-2">
    <p className={`text-[11px] font-black uppercase tracking-wide leading-tight ${notif.read ? "text-(--t2)" : "text-(--t1)"}`}>
    {notif.title}
    </p>
    {!notif.read && (
      <button onClick={onMarkRead} title="Позначити як прочитане"
      className="w-2 h-2 rounded-full bg-blue-500 flex-shrink-0 mt-1 hover:bg-blue-700 transition-colors" />
    )}
    </div>
    <p className="text-[10px] font-bold text-(--t2) mt-0.5 leading-relaxed">{notif.message}</p>

    {meta.team_id && (
      <button onClick={() => onGoTeam(meta.team_id!)}
      className="mt-1.5 flex items-center gap-1 text-[9px] font-black uppercase tracking-widest text-blue-500 hover:text-blue-400 transition-colors">
      <Users size={9} /> {meta.team_name} <ChevronRight size={8} />
      </button>
    )}
    {isInvite && meta.inviter_name && (
      <p className="mt-0.5 text-[9px] font-black uppercase tracking-widest text-(--t2) flex items-center gap-1">
      <Crown size={8} className="text-amber-500" /> Від: {meta.inviter_name}
      </p>
    )}
    <p className="mt-1 text-[9px] font-black uppercase tracking-widest text-(--t2) opacity-50">
    {timeAgo(notif.created_at)}
    </p>

    {isInvite && !responded && (
      <div className="flex items-center gap-1.5 mt-2.5">
      <button onClick={onAccept} disabled={!!responding}
      className="flex items-center gap-1 px-3 py-1.5 rounded-lg bg-blue-600 text-white font-black text-[10px] uppercase tracking-widest hover:bg-blue-700 active:scale-95 transition-all disabled:opacity-60">
      {responding === "accept" ? <Loader size={10} className="animate-spin" /> : <Check size={10} />} Прийняти
      </button>
      <button onClick={onDecline} disabled={!!responding}
      className="flex items-center gap-1 px-3 py-1.5 rounded-lg bg-(--card) border border-(--brd) text-(--t2) font-black text-[10px] uppercase tracking-widest hover:border-red-500/40 hover:text-red-500 active:scale-95 transition-all disabled:opacity-60">
      {responding === "decline" ? <Loader size={10} className="animate-spin" /> : <X size={10} />} Відхилити
      </button>
      </div>
    )}
    {isInvite && responded && (
      <div className={`mt-2 inline-flex items-center gap-1 px-2.5 py-1 rounded-md text-[9px] font-black uppercase tracking-widest border ${
        responded === "accepted" ? "bg-green-500/10 text-green-500 border-green-500/20" : "bg-red-500/10 text-red-500 border-red-500/20"
      }`}>
      {responded === "accepted" ? <><Check size={9} /> Прийнято</> : <><X size={9} /> Відхилено</>}
      </div>
    )}
    </div>
    </div>
    </div>
  );
}

// ── Main page ─────────────────────────────────────────────────────────────────

export default function ProfilePage() {
  const [isMobileSidebarOpen, setIsMobileSidebarOpen] = useState(false);
  const { dark } = useTheme();
  const router = useRouter();
  const { user: currentUser, token, isLoading: authLoading } = useAuth();

  const [profileUser, setProfileUser]   = useState<any>(null);
  const [isLoading, setIsLoading]       = useState(true);
  const [error, setError]               = useState<string | null>(null);
  const [isEditing, setIsEditing]       = useState(false);
  const [showAvatarEditor, setShowAvatarEditor] = useState(false);

  const [selectedRole, setSelectedRole]     = useState<Role>("user");
  const [isChangingRole, setIsChangingRole] = useState(false);
  const [roleMsg, setRoleMsg]               = useState<{ type: "ok" | "err"; text: string } | null>(null);

  const isSuperAdmin = currentUser?.role === "superadmin";
  const isOwnProfile = currentUser?.id === profileUser?.id;
  const { teams: userTeams, loading: teamsLoading } = useUserTeams(currentUser?.id);

  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [notifLoading, setNotifLoading]   = useState(true);
  const [responding, setResponding]       = useState<Record<string, "accept" | "decline" | null>>({});
  const [responded, setResponded]         = useState<Record<string, "accepted" | "declined">>({});

  const [tournaments, setTournaments] = useState<Tournament[]>([]);
  const [tourLoading, setTourLoading] = useState(true);

  const allReady = !isLoading && !teamsLoading && !tourLoading && !notifLoading;
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    if (allReady) {
      const t = setTimeout(() => setVisible(true), 50);
      return () => clearTimeout(t);
    }
  }, [allReady]);

  const authHeader = useCallback((): Record<string, string> => {
    const t = (typeof window !== "undefined" && localStorage.getItem("access_token")) || token || "";
    return { "Content-Type": "application/json", Authorization: `Bearer ${t}` };
  }, [token]);

  const fetchNotifications = useCallback(async () => {
    setNotifLoading(true);
    try {
      const res = await fetch(`${API_URL}/api/notifications?limit=50`, { headers: authHeader() });
      const data = await res.json();
      setNotifications(data.notifications ?? []);
    } catch { setNotifications([]); }
    finally { setNotifLoading(false); }
  }, [authHeader]);

  const fetchTournaments = useCallback(async () => {
    setTourLoading(true);
    try {
      const res = await fetch(`${API_URL}/api/users/me/tournaments`, { headers: authHeader() });
      if (res.ok) {
        const data = await res.json();
        setTournaments(data.tournaments ?? []);
      } else { setTournaments([]); }
    } catch { setTournaments([]); }
    finally { setTourLoading(false); }
  }, [authHeader]);

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
    fetchNotifications();
    fetchTournaments();
  }, [authLoading, currentUser, router, fetchNotifications, fetchTournaments]);

  const markAllRead = async () => {
    await fetch(`${API_URL}/api/notifications/mark-read`, {
      method: "POST", headers: authHeader(), body: JSON.stringify({ all: true }),
    });
    setNotifications(prev => prev.map(n => ({ ...n, read: true })));
  };

  const markRead = async (id: string) => {
    await fetch(`${API_URL}/api/notifications/mark-read`, {
      method: "POST", headers: authHeader(), body: JSON.stringify({ ids: [id] }),
    });
    setNotifications(prev => prev.map(n => n.id === id ? { ...n, read: true } : n));
  };

  const respondInvitation = async (notif: Notification, accept: boolean) => {
    const meta = parseMeta(notif.meta);
    const invitationId = meta.invitation_id;
    if (!invitationId) return;
    const key = notif.id;
    setResponding(prev => ({ ...prev, [key]: accept ? "accept" : "decline" }));
    try {
      const res = await fetch(`${API_URL}/api/invitations/respond`, {
        method: "POST", headers: authHeader(),
                              body: JSON.stringify({ invitation_id: invitationId, accept }),
      });
      if (!res.ok) { const err = await res.json(); alert(err.detail ?? "Помилка відповіді"); return; }
      setResponded(prev => ({ ...prev, [key]: accept ? "accepted" : "declined" }));
      await markRead(notif.id);
    } catch { alert("Помилка з'єднання з сервером"); }
    finally { setResponding(prev => ({ ...prev, [key]: null })); }
  };

  const unreadCount = notifications.filter(n => !n.read).length;

  const handleRoleChange = async () => {
    if (!isSuperAdmin || !profileUser) return;
    setIsChangingRole(true); setRoleMsg(null);
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

  // ── Layout ─────────────────────────────────────────────────────────────────

  if (authLoading) return (
    <div className="min-h-screen bg-(--bg) flex items-center justify-center">
    <div className="w-8 h-8 border-2 border-blue-600 border-t-transparent rounded-full animate-spin" />
    </div>
  );

  if (!currentUser) return null;

  return (
    <div className="flex h-screen overflow-hidden bg-(--bg) text-(--t1) transition-colors duration-300">
    <style dangerouslySetInnerHTML={{__html: `
      @keyframes fadeUp { from{opacity:0;transform:translateY(12px)} to{opacity:1;transform:none} }
      .fade-up, .fade-up-1, .fade-up-2, .fade-up-3, .fuIn { opacity: 0; }
      .page-ready .fade-up   { animation: fadeUp 400ms ease 0ms both }
      .page-ready .fade-up-1 { animation: fadeUp 400ms ease 100ms both }
      .page-ready .fade-up-2 { animation: fadeUp 400ms ease 200ms both }
      .page-ready .fade-up-3 { animation: fadeUp 400ms ease 300ms both }
      .page-ready .fuIn      { animation: fadeUp 300ms ease 50ms both }
      `}} />

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
      <div className={`flex-1 overflow-y-auto p-4 sm:p-6 md:p-8 relative z-10 ${allReady ? "page-ready" : ""}`}>

      {/* Breadcrumb */}
      <nav className="flex items-center gap-2 text-[10px] font-black mb-5 uppercase tracking-widest text-(--t2)">
      <button onClick={() => router.push("/")} className="hover:text-blue-600 transition-colors">Головна</button>
      <ChevronRight size={10} />
      <span className="text-(--t1)">Профіль</span>
      </nav>

      <button onClick={() => router.back()} className="mb-5 flex items-center gap-2 text-[11px] font-black uppercase tracking-widest text-(--t2) hover:text-blue-600 transition-colors">
      <ArrowLeft size={14} /> Назад
      </button>

      {/* Loading overlay */}
      {!allReady && !error && (
        <div className="fixed inset-0 z-50 flex items-center justify-center pointer-events-none">
        <div className="flex flex-col items-center gap-3">
        <div className="w-10 h-10 border-2 border-blue-600 border-t-transparent rounded-full animate-spin" />
        <p className="text-[10px] font-black uppercase tracking-widest text-blue-600 opacity-70">Завантаження...</p>
        </div>
        </div>
      )}

      {error ? (
        <div className="flex-1 overflow-y-auto p-4 sm:p-6 md:p-8 relative z-10">
        <p className="text-lg font-black text-(--t1) mb-2">{error}</p>
        <p className="text-(--t2) text-sm">Користувача не знайдено</p>
        </div>
      ) : (
        <div className="flex flex-col xl:flex-row gap-6 items-start w-full">

        {/* ══ LEFT COLUMN ══════════════════════════════════════════════ */}
        <div className="flex flex-col gap-5 w-full xl:flex-1 min-w-0">

        {/* Profile card */}
        <section className="fade-up bg-(--card) rounded-2xl sm:rounded-[2.5rem] shadow-sm border border-(--brd) p-5 sm:p-7 relative overflow-hidden">
        <div className="absolute right-0 top-0 opacity-5 pointer-events-none text-(--t1) hidden md:block">
        <Shield size={220} />
        </div>

        {isLoading ? (
          /* ── Skeleton ── */
          <div className="flex flex-col sm:flex-row items-center sm:items-start gap-5 animate-pulse">
          <div className="w-[88px] h-[88px] rounded-full flex-shrink-0" style={{background:"var(--brd)"}} />
          <div className="flex-1 space-y-3 w-full">
          <div className="flex items-center justify-between">
          <div className="h-6 w-36 rounded-xl" style={{background:"var(--brd)"}} />
          <div className="h-8 w-24 rounded-xl" style={{background:"var(--brd)"}} />
          </div>
          <div className="flex gap-2">
          <div className="h-5 w-20 rounded-lg" style={{background:"var(--brd)"}} />
          <div className="h-5 w-16 rounded-lg" style={{background:"var(--brd)"}} />
          </div>
          <div className="space-y-2 pt-1">
          <div className="h-4 w-48 rounded-lg" style={{background:"var(--brd)"}} />
          <div className="h-4 w-44 rounded-lg" style={{background:"var(--brd)"}} />
          <div className="h-4 w-52 rounded-lg" style={{background:"var(--brd)"}} />
          <div className="h-4 w-32 rounded-lg" style={{background:"var(--brd)"}} />
          </div>
          <div className="pt-2 border-t border-(--brd)">
          <div className="h-3 w-64 rounded-lg" style={{background:"var(--brd)"}} />
          </div>
          </div>
          </div>
        ) : isEditing ? (
          <EditProfileSection
          profileUser={profileUser}
          onSave={(updated) => { setProfileUser((prev: any) => ({ ...prev, ...updated })); setIsEditing(false); }}
          onCancel={() => setIsEditing(false)}
          />
        ) : (
          <>
          <div className="flex flex-col sm:flex-row items-center sm:items-start gap-5">

          {/* ── Avatar ── */}
          <div className="relative flex-shrink-0 group">
          <div
          className="rounded-full bg-blue-600/10 flex items-center justify-center border-4 border-(--brd) shadow-md overflow-hidden"
          style={{ width: 88, height: 88 }}
          >
          {profileUser?.avatar_url ? (
            <img
            src={profileUser.avatar_url}
            alt="avatar"
            className="w-full h-full object-cover"
            />
          ) : (
            <span className="text-3xl font-black text-blue-600">
            {profileUser?.username?.charAt(0).toUpperCase() ?? "?"}
            </span>
          )}
          </div>

          {profileUser?.status === "active" && (
            <span className="absolute bottom-1 right-1 w-4 h-4 bg-green-500 border-4 border-(--card) rounded-full shadow-sm" />
          )}

          {/* Edit button — only own profile */}
          {isOwnProfile && (
            <button
            onClick={() => setShowAvatarEditor(true)}
            className="absolute inset-0 flex items-center justify-center rounded-full bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity"
            style={{ width: 88, height: 88 }}
            >
            <Pencil size={15} className="text-white" />
            </button>
          )}
          </div>

          <div className="flex-1 space-y-2.5 z-10 w-full text-left">
          <div className="flex flex-row items-center justify-between gap-2">
          <h1 className="text-xl font-black text-(--t1) uppercase tracking-tight">{profileUser?.username}</h1>
          {isOwnProfile && (
            <button onClick={() => setIsEditing(true)}
            className="flex items-center gap-1.5 border border-(--brd) text-(--t2) font-black text-[10px] uppercase tracking-widest rounded-xl px-3 py-2 hover:border-blue-600/40 hover:text-blue-600 active:scale-95 transition-all">
            <Pencil size={11} /> Редагувати
            </button>
          )}
          </div>

          <div className="flex items-center gap-2 flex-wrap">
          {isOwnProfile && (
            <span className="text-[9px] font-black uppercase bg-blue-500/10 text-blue-500 border border-blue-500/20 px-2.5 py-1 rounded-lg">
            Ваш профіль
            </span>
          )}
          <span className={`text-[9px] font-black uppercase px-2.5 py-1 rounded-lg border ${roleBadgeColor[profileUser?.role as Role] ?? roleBadgeColor.user}`}>
          {profileUser?.role ?? "user"}
          </span>
          </div>

          <div className="mt-2 space-y-2 text-sm">
          <p className="flex items-center gap-2.5 font-medium">
          <User size={14} className="text-blue-600 flex-shrink-0" />
          <span className="text-(--t2) text-xs">Ім'я:</span>
          <span className="font-bold text-sm">{profileUser?.username}</span>
          </p>
          <p className="flex items-center gap-2.5 font-medium">
          <User size={14} className="text-blue-600 flex-shrink-0" />
          <span className="text-(--t2) text-xs">Логін:</span>
          <span className="font-bold text-sm">{profileUser?.login}</span>
          </p>
          <p className="flex items-center gap-2.5 font-medium">
          <Mail size={14} className="text-blue-600 flex-shrink-0" />
          <span className="text-(--t2) text-xs">Email:</span>
          <span className="font-bold text-sm break-all">{profileUser?.email}</span>
          </p>
          <p className="flex items-center gap-2.5 font-medium">
          <Shield size={14} className="text-blue-600 flex-shrink-0" />
          <span className="text-(--t2) text-xs">Роль:</span>
          <span className={`text-[9px] font-black uppercase px-2 py-0.5 rounded-md border ${roleBadgeColor[profileUser?.role as Role] ?? roleBadgeColor.user}`}>
          {profileUser?.role ?? "user"}
          </span>
          </p>
          </div>

          <div className="pt-2.5 border-t border-(--brd) text-[9px] font-bold uppercase tracking-widest text-(--t2)">
          ID: {profileUser?.id}
          </div>
          </div>
          </div>

          {/* SuperAdmin: role change */}
          {isSuperAdmin && (
            <div className="mt-5 pt-5 border-t border-(--brd) space-y-3">
            <h3 className="text-xs font-black uppercase tracking-widest text-(--t2) flex items-center gap-2">
            <Shield size={12} /> Зміна ролі
            </h3>
            <div className="flex flex-wrap gap-2 items-center">
            {ROLES.map(r => (
              <button key={r} onClick={() => setSelectedRole(r)}
              className={`text-[9px] font-black uppercase px-3 py-1.5 rounded-lg border transition-all ${
                selectedRole === r
                ? roleBadgeColor[r] + " scale-105"
                : "border-(--brd) text-(--t2) hover:border-blue-600/40"
              }`}>
              {r}
              </button>
            ))}
            <button onClick={handleRoleChange} disabled={isChangingRole || selectedRole === profileUser?.role}
            className="flex items-center gap-1.5 bg-blue-600 text-white font-black text-[10px] uppercase tracking-widest rounded-xl px-4 py-2 hover:bg-blue-700 active:scale-95 transition-all disabled:opacity-40 shadow-lg shadow-blue-600/20">
            {isChangingRole ? <Loader size={11} className="animate-spin" /> : <Save size={11} />}
            Застосувати
            </button>
            </div>
            {roleMsg && (
              <div className={`flex items-center gap-2 p-2.5 rounded-xl text-xs font-bold border ${
                roleMsg.type === "ok"
                ? "bg-green-500/10 border-green-500/20 text-green-600"
                : "bg-red-500/10 border-red-500/20 text-red-500"
              }`}>
              {roleMsg.type === "ok" ? <CheckCircle size={13} /> : <AlertCircle size={13} />}
              {roleMsg.text}
              </div>
            )}
            </div>
          )}
          </>
        )}
        </section>

        {/* Teams */}
        <section className="fade-up-1 bg-(--card) rounded-2xl sm:rounded-[2.5rem] shadow-sm border border-(--brd) overflow-hidden">
        <div className="flex items-center gap-3 px-5 sm:px-7 py-3.5 border-b border-(--brd) bg-(--bg)/[40]">
        <div className="w-7 h-7 rounded-xl bg-blue-600/10 text-blue-600 flex items-center justify-center flex-shrink-0">
        <Users size={14} />
        </div>
        <div>
        <p className="text-xs font-black uppercase tracking-widest text-(--t1)">Команди</p>
        {!teamsLoading && userTeams.length > 0 && (
          <p className="text-[10px] font-bold text-(--t2) mt-0.5">{userTeams.length} команд</p>
        )}
        </div>
        </div>
        <div className="p-5 sm:p-7">
        {teamsLoading ? (
          <div className="space-y-2">
          {[1,2].map(i => (
            <div key={i} className="h-[60px] rounded-2xl animate-pulse" style={{background:"var(--brd)"}} />
          ))}
          </div>
        ) : userTeams.length === 0 ? (
          <div className="text-center py-5">
          <div className="w-10 h-10 rounded-2xl bg-(--bg) border border-(--brd) flex items-center justify-center mx-auto mb-2">
          <Users className="w-5 h-5 text-(--t2) opacity-40" />
          </div>
          <p className="text-[11px] font-bold text-(--t2) uppercase tracking-wider">Не перебуває в жодній команді</p>
          <button onClick={() => router.push("/register_team")} className="mt-3 text-[10px] font-black uppercase tracking-widest text-blue-600 hover:underline">
          Створити команду →
          </button>
          </div>
        ) : (
          <div className="space-y-2">
          {userTeams.map(team => {
            const isCaptain = team.captain_id === profileUser.id;
            const memberCount = team.members_ids?.length ?? 0;
            return (
              <button key={team.id} type="button" onClick={() => router.push("/teams/" + team.id)}
              className="w-full flex items-center gap-3 p-3.5 rounded-2xl border border-(--brd) bg-(--bg) hover:border-blue-600/40 hover:bg-blue-600/5 transition-all group text-left">
              <div className="w-9 h-9 rounded-xl bg-blue-600/10 border border-blue-600/20 flex items-center justify-center text-blue-600 font-black text-sm flex-shrink-0">
              {team.name.charAt(0).toUpperCase()}
              </div>
              <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 flex-wrap">
              <span className="font-black text-(--t1) text-sm truncate group-hover:text-blue-600 transition-colors">{team.name}</span>
              {isCaptain && (
                <span className="text-[8px] font-black uppercase bg-amber-500/10 text-amber-500 border border-amber-500/20 px-1.5 py-0.5 rounded-md flex-shrink-0 flex items-center gap-1">
                <Crown size={7} /> Капітан
                </span>
              )}
              </div>
              <div className="flex items-center gap-2 mt-0.5">
              {team.city_school_org && <span className="text-[10px] font-bold text-(--t2) truncate">{team.city_school_org}</span>}
              <span className="text-[10px] font-bold text-(--t2) flex items-center gap-1 flex-shrink-0">
              <Users size={8} /> {memberCount} уч.
              </span>
              </div>
              </div>
              <ExternalLink size={13} className="text-(--t2) flex-shrink-0 opacity-0 group-hover:opacity-100 transition-opacity" />
              </button>
            );
          })}
          </div>
        )}
        </div>
        </section>

        {/* Tournaments */}
        <section className="fade-up-2 bg-(--card) rounded-2xl sm:rounded-[2.5rem] shadow-sm border border-(--brd) overflow-hidden">
        <div className="flex items-center gap-3 px-5 sm:px-7 py-3.5 border-b border-(--brd) bg-(--bg)/[40]">
        <div className="w-7 h-7 rounded-xl bg-amber-500/10 text-amber-500 flex items-center justify-center flex-shrink-0">
        <Trophy size={14} />
        </div>
        <div>
        <p className="text-xs font-black uppercase tracking-widest text-(--t1)">Турніри</p>
        {!tourLoading && tournaments.length > 0 && (
          <p className="text-[10px] font-bold text-(--t2) mt-0.5">{tournaments.length} турнірів</p>
        )}
        </div>
        </div>
        <div className="p-5 sm:p-7">
        {tourLoading ? (
          <div className="space-y-2">
          {[1,2].map(i => (
            <div key={i} className="h-[60px] rounded-2xl animate-pulse" style={{background:"var(--brd)"}} />
          ))}
          </div>
        ) : tournaments.length === 0 ? (
          <div className="text-center py-5">
          <div className="w-10 h-10 rounded-2xl bg-(--bg) border border-(--brd) flex items-center justify-center mx-auto mb-2">
          <Trophy className="w-5 h-5 text-(--t2) opacity-40" />
          </div>
          <p className="text-[11px] font-bold text-(--t2) uppercase tracking-wider">Не бере участь у турнірах</p>
          <button onClick={() => router.push("/tournaments")} className="mt-3 text-[10px] font-black uppercase tracking-widest text-amber-500 hover:underline">
          Переглянути турніри →
          </button>
          </div>
        ) : (
          <div className="space-y-2">
          {tournaments.map((t, i) => {
            const st = t.status ?? "upcoming";
            const stStyle = tourStatusStyle[st] ?? tourStatusStyle.upcoming;
            const stLabel = tourStatusLabel[st] ?? st;
            return (
              <button key={t.id} type="button" onClick={() => router.push("/tournaments/" + t.id)}
              className="w-full flex items-center gap-3 p-3.5 rounded-2xl border border-(--brd) bg-(--bg) hover:border-amber-500/40 hover:bg-amber-500/5 transition-all group text-left"
              style={{ animationDelay: `${i * 40}ms` }}>
              <div className="w-9 h-9 rounded-xl bg-amber-500/10 border border-amber-500/20 flex items-center justify-center text-amber-500 font-black text-sm flex-shrink-0">
              {t.place === 1 ? "🥇" : t.place === 2 ? "🥈" : t.place === 3 ? "🥉" : <Trophy size={15} />}
              </div>
              <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 flex-wrap">
              <span className="font-black text-(--t1) text-sm truncate group-hover:text-amber-500 transition-colors">{t.name}</span>
              <span className={`text-[8px] font-black uppercase px-1.5 py-0.5 rounded-md border flex-shrink-0 ${stStyle}`}>
              {stLabel}
              </span>
              </div>
              <div className="flex items-center gap-2 mt-0.5 flex-wrap">
              {t.game && <span className="text-[10px] font-bold text-(--t2) truncate">{t.game}</span>}
              {t.team_name && (
                <span className="text-[10px] font-bold text-(--t2) flex items-center gap-1">
                <Users size={8} /> {t.team_name}
                </span>
              )}
              {t.place && (
                <span className="text-[10px] font-black text-amber-500 flex items-center gap-1">
                <Medal size={8} /> {t.place} місце
                </span>
              )}
              </div>
              {(t.start_date || t.end_date) && (
                <p className="text-[9px] font-bold text-(--t2) mt-0.5 opacity-60">
                {t.start_date && new Date(t.start_date).toLocaleDateString("uk-UA")}
                {t.start_date && t.end_date && " — "}
                {t.end_date && new Date(t.end_date).toLocaleDateString("uk-UA")}
                </p>
              )}
              </div>
              <ExternalLink size={13} className="text-(--t2) flex-shrink-0 opacity-0 group-hover:opacity-100 transition-opacity" />
              </button>
            );
          })}
          </div>
        )}
        </div>
        </section>

        </div>

        {/* ══ RIGHT COLUMN — Notifications ═════════════════════════════ */}
        <div className="flex flex-col gap-5 w-full xl:w-[380px] flex-shrink-0">
        <section className="fade-up bg-(--card) rounded-2xl sm:rounded-[2.5rem] shadow-sm border border-(--brd) overflow-hidden">
        <div className="flex items-center justify-between gap-2 px-5 sm:px-6 py-3.5 border-b border-(--brd) bg-(--bg)/[40]">
        <div className="flex items-center gap-2.5">
        <div className="relative w-7 h-7 rounded-xl bg-blue-600/10 text-blue-600 flex items-center justify-center flex-shrink-0">
        <Bell size={14} />
        {unreadCount > 0 && (
          <span className="absolute -top-1 -right-1 w-4 h-4 rounded-full bg-blue-600 text-white text-[9px] font-black flex items-center justify-center">
          {unreadCount > 9 ? "9+" : unreadCount}
          </span>
        )}
        </div>
        <div>
        <p className="text-xs font-black uppercase tracking-widest text-(--t1)">Сповіщення</p>
        {!notifLoading && (
          <p className="text-[10px] font-bold text-(--t2) mt-0.5">
          {unreadCount > 0 ? `${unreadCount} непрочитаних` : "Все прочитано"}
          </p>
        )}
        </div>
        </div>
        {unreadCount > 0 && (
          <button onClick={markAllRead}
          className="flex items-center gap-1.5 text-[10px] font-black uppercase tracking-widest text-(--t2) hover:text-blue-600 border border-(--brd) bg-(--bg) rounded-xl px-3 py-1.5 transition-all hover:border-blue-600/40 active:scale-95">
          <CheckCheck size={12} /> Всі
          </button>
        )}
        </div>

        <div className="p-4 sm:p-5 max-h-[calc(100vh-220px)] overflow-y-auto">
        {notifLoading ? (
          <div className="space-y-2.5">
          {[1,2,3].map(i => (
            <div key={i} className="h-[72px] rounded-xl animate-pulse" style={{background:"var(--brd)"}} />
          ))}
          </div>
        ) : notifications.length === 0 ? (
          <div className="flex flex-col items-center py-12 text-center">
          <Bell className="w-10 h-10 text-(--t2) mb-3 opacity-25" />
          <p className="text-sm font-black text-(--t1) mb-1">Немає сповіщень</p>
          <p className="text-(--t2) text-xs font-medium">Тут з'являться запрошення до команд</p>
          </div>
        ) : (
          <div className="space-y-2.5">
          {notifications.map((notif, i) => (
            <NotificationCard
            key={notif.id}
            notif={notif}
            idx={i}
            responded={responded[notif.id]}
            responding={responding[notif.id] ?? null}
            onAccept={() => respondInvitation(notif, true)}
            onDecline={() => respondInvitation(notif, false)}
            onMarkRead={() => markRead(notif.id)}
            onGoTeam={(teamId) => router.push("/teams/" + teamId)}
            />
          ))}
          </div>
        )}
        </div>
        </section>
        </div>

        </div>
      )}
      </div>
      </main>

      {/* ── Avatar Editor Modal ── */}
      {showAvatarEditor && profileUser && (
        <AvatarEditorModal
        userId={profileUser.id}
        supabase={supabase}
        onSave={(url) => setProfileUser((prev: any) => ({ ...prev, avatar_url: url }))}
        onClose={() => setShowAvatarEditor(false)}
        />
      )}
      </div>
  );
}
