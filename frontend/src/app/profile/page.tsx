//site_turing_CrutchMasters_team-s/frontend/src/app/profile/page.tsx
"use client";

import React, { useState, useEffect, useRef, useCallback } from "react";
import { createPortal } from "react-dom";
import { useRouter } from "next/navigation";
import {
  User, Mail, Shield, ChevronRight, UserCircle, ArrowLeft, Loader,
  Users, Crown, ExternalLink, Lock, Eye, EyeOff, KeyRound,
  CheckCircle, AlertCircle, RefreshCw, Pencil, X, Save,
  Bell, Check, CheckCheck, UserPlus, Trophy, Star, Flag, FileText,
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

type Role = "user" | "jury" | "admin" | "superadmin";

const roleBadgeColor: Record<Role, string> = {
  user:       "bg-gray-500/10 text-gray-500 border-gray-500/20",
  jury:       "bg-amber-500/10 text-amber-500 border-amber-500/20",
  admin:      "bg-orange-500/10 text-orange-500 border-orange-500/20",
  superadmin: "bg-red-500/10 text-red-500 border-red-500/20",
};

// ── Types ─────────────────────────────────────────────────────────────────────

interface UserTeam {
  id: string; name: string; city_school_org?: string;
  captain_id?: string; members_ids?: string[];
}

interface NotifMeta {
  invitation_id?: string; team_id?: string; team_name?: string;
  inviter_id?: string; inviter_name?: string; new_member?: string;
  tournament_id?: string; tournament_name?: string;
}

interface Notification {
  id: string; type: string; title: string; message: string;
  meta: string | NotifMeta | null; read: boolean; created_at: string;
}

interface Tournament {
  id: string; name: string; status?: string; start_at?: string;
}

// Jury-specific
interface JuryTournament {
  id: string; name: string; status: string; start_at?: string;
  invitation_status: "pending" | "accepted" | "declined";
}

interface JuryRound {
  id: string; number: number; name?: string;
  tournament_id: string; tournament_name?: string;
  end_at?: string; status?: string;
}

interface JurySubmission {
  id: string; team_name?: string; submitted_at: string;
  github_url?: string; status: string; round_id: string;
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
  jury_invitation:     <Star     size={14} className="text-amber-500" />,
};

const typeBorder: Record<string, string> = {
  team_invitation:     "border-l-blue-500",
  invitation_accepted: "border-l-green-500",
  invitation_declined: "border-l-red-500",
  jury_invitation:     "border-l-amber-500",
};

const tourStatusStyle: Record<string, string> = {
  registration: "text-purple-500 bg-purple-500/10 border-purple-500/20",
  active:   "text-green-500 bg-green-500/10 border-green-500/20",
  ongoing:  "text-green-500 bg-green-500/10 border-green-500/20",
  upcoming: "text-blue-500 bg-blue-500/10 border-blue-500/20",
  finished: "text-(--t2) bg-(--bg) border-(--brd)",
};

const tourStatusLabel: Record<string, string> = {
  registration: "Реєстрація", active: "Активний", ongoing: "Активний",
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
        const { data: captainTeams } = await supabase.from("teams").select("id, name, city_school_org, captain_id, members_ids").eq("captain_id", userId);
        const { data: memberTeams } = await supabase.from("teams").select("id, name, city_school_org, captain_id, members_ids").contains("members_ids", JSON.stringify([userId]));
        const all = [...(captainTeams ?? []), ...(memberTeams ?? [])];
        setTeams(all.filter((t, i, a) => a.findIndex(x => x.id === t.id) === i));
      } finally { setLoading(false); }
    };
    run();
  }, [userId]);
  return { teams, loading };
}

// ── Jury data hook ────────────────────────────────────────────────────────────
function useJuryData(userId: string | undefined, isJury: boolean) {
  const [juryTournaments, setJuryTournaments] = useState<JuryTournament[]>([]);
  const [juryRounds, setJuryRounds]           = useState<JuryRound[]>([]);
  const [jurySubmissions, setJurySubmissions] = useState<JurySubmission[]>([]);
  const [loading, setLoading]                 = useState(false);

  useEffect(() => {
    if (!userId || !isJury) return;
    const run = async () => {
      setLoading(true);
      try {
        const token = (typeof window !== "undefined" && localStorage.getItem("access_token")) || "";
        const headers = { Authorization: `Bearer ${token}` };

        // 1. Турніри через jury_tournament_invitations
        const invRes = await fetch(`${API_URL}/api/jury-invitations/my`, { headers });
        if (invRes.ok) {
          const data = await invRes.json();
          const invitations: any[] = data.invitations ?? [];
          setJuryTournaments(invitations.map(inv => ({
            id:                inv.tournament_id,
            name:              inv.tournament_name ?? "—",
            status:            inv.tournament_status ?? "upcoming",
            start_at:          inv.tournament_start_at,
            invitation_status: inv.status,
          })));
        }

        // 2. Раунди через jury_assignments
        const { data: assignments } = await supabase
          .from("jury_assignments")
          .select("round_id, tournament_id")
          .eq("jury_id", userId);

        if (assignments && assignments.length > 0) {
          const roundIds = assignments.map(a => a.round_id);
          const { data: rounds } = await supabase
            .from("rounds")
            .select("id, number, name, tournament_id, end_at, status")
            .in("id", roundIds)
            .order("number");

          if (rounds) {
            // Отримуємо назви турнірів
            const tourIds = [...new Set(rounds.map(r => r.tournament_id).filter(Boolean))];
            const { data: tours } = await supabase.from("tournaments").select("id, name").in("id", tourIds);
            const tourMap: Record<string, string> = {};
            (tours ?? []).forEach(t => { tourMap[t.id] = t.name; });

            setJuryRounds(rounds.map(r => ({
              id:              r.id,
              number:          r.number,
              name:            r.name,
              tournament_id:   r.tournament_id,
              tournament_name: tourMap[r.tournament_id] ?? "—",
              end_at:          r.end_at,
              status:          r.status,
            })));

            // 3. Submissions у цих раундах
            const { data: subs } = await supabase
              .from("submissions")
              .select("id, team_id, submitted_at, github_url, status, round_id")
              .in("round_id", roundIds)
              .order("submitted_at", { ascending: false })
              .limit(20);

            if (subs && subs.length > 0) {
              const teamIds = [...new Set(subs.map(s => s.team_id).filter(Boolean))];
              const { data: teams } = await supabase.from("teams").select("id, name").in("id", teamIds);
              const teamMap: Record<string, string> = {};
              (teams ?? []).forEach(t => { teamMap[t.id] = t.name; });
              setJurySubmissions(subs.map(s => ({
                id:           s.id,
                team_name:    teamMap[s.team_id] ?? "—",
                submitted_at: s.submitted_at,
                github_url:   s.github_url,
                status:       s.status,
                round_id:     s.round_id,
              })));
            }
          }
        }
      } finally { setLoading(false); }
    };
    run();
  }, [userId, isJury]);

  return { juryTournaments, juryRounds, jurySubmissions, loading };
}

// ── OTP code input ────────────────────────────────────────────────────────────
function CodeInput({ value, onChange, disabled }: { value: string; onChange: (v: string) => void; disabled?: boolean }) {
  const inputs = useRef<(HTMLInputElement | null)[]>([]);
  const slots: string[] = Array.from({ length: 6 }, (_, i) => {
    const ch = value[i]; return ch && /\d/.test(ch) ? ch : "";
  });
  const handleChange = (i: number, v: string) => {
    const d = v.replace(/\D/g, "").slice(-1);
    const next = slots.map((c, idx) => (idx === i ? d : c)).join("");
    onChange(next);
    if (d && i < 5) setTimeout(() => inputs.current[i + 1]?.focus(), 0);
  };
  const handleKeyDown = (i: number, e: React.KeyboardEvent) => {
    if (e.key === "Backspace") {
      if (slots[i]) { const next = slots.map((c, idx) => (idx === i ? "" : c)).join(""); onChange(next); }
      else if (i > 0) { inputs.current[i - 1]?.focus(); const next = slots.map((c, idx) => (idx === i - 1 ? "" : c)).join(""); onChange(next); }
    }
    if (e.key === "ArrowLeft" && i > 0) inputs.current[i - 1]?.focus();
    if (e.key === "ArrowRight" && i < 5) inputs.current[i + 1]?.focus();
  };
  const handlePaste = (e: React.ClipboardEvent) => {
    e.preventDefault();
    const pasted = e.clipboardData.getData("text").replace(/\D/g, "").slice(0, 6);
    onChange(pasted);
    setTimeout(() => inputs.current[Math.min(pasted.length, 5)]?.focus(), 0);
  };
  return (
    <div className="flex gap-2 justify-center">
    {slots.map((digit, i) => (
      <input key={i} ref={el => { inputs.current[i] = el; }} type="text" inputMode="numeric" maxLength={1}
      value={digit} onChange={e => handleChange(i, e.target.value)} onKeyDown={e => handleKeyDown(i, e)} onPaste={handlePaste} disabled={disabled}
      className={`w-11 h-14 text-center text-2xl font-black rounded-xl border-2 outline-none transition-all duration-150 disabled:opacity-40 ${digit ? "border-blue-600 bg-blue-600/10 text-blue-600 shadow-md shadow-blue-600/25" : "border-(--brd) bg-(--bg) text-(--t1) focus:border-blue-500 focus:bg-blue-500/5"}`} />
    ))}
    </div>
  );
}

// ── Edit Profile Section ──────────────────────────────────────────────────────
type PwStep = "idle" | "sending" | "code" | "verifying" | "newpw" | "done";

function EditProfileSection({ profileUser, onSave, onCancel, onModalChange }: {
  profileUser: any; onSave: (updated: { username: string; login: string }) => void; onCancel: () => void; onModalChange?: (open: boolean) => void;
}) {
  const [username, setUsername] = useState(profileUser.username ?? "");
  const [login, setLogin]       = useState(profileUser.login ?? "");
  const [saving, setSaving]     = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [pwStep, setPwStep]     = useState<PwStep>("idle");
  const [code, setCode]         = useState("");
  const [newPw, setNewPw]       = useState("");
  const [confirmPw, setConfirmPw] = useState("");
  const [showPw, setShowPw]     = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const [pwError, setPwError]   = useState<string | null>(null);
  const [resendCooldown, setResendCooldown] = useState(0);
  const [showPwModal, setShowPwModal] = useState(false);

  useEffect(() => {
    if (resendCooldown <= 0) return;
    const t = setInterval(() => setResendCooldown(p => Math.max(0, p - 1)), 1000);
    return () => clearInterval(t);
  }, [resendCooldown]);

  const pwStrength = (() => {
    if (!newPw) return null; let s = 0;
    if (newPw.length >= 8) s++; if (/[A-Z]/.test(newPw)) s++;
    if (/[0-9]/.test(newPw)) s++; if (/[^A-Za-z0-9]/.test(newPw)) s++;
    return s;
  })();

  async function handleSave() {
    setSaving(true); setSaveError(null);
    try {
      const { error } = await supabase.from("account").update({ username, login }).eq("id", profileUser.id);
      if (error) throw error;
      onSave({ username, login });
    } catch (e: any) { setSaveError(e?.message ?? "Помилка збереження"); }
    finally { setSaving(false); }
  }
  async function sendCode() {
    setPwError(null); setPwStep("sending");
    try {
      const { error } = await supabase.auth.resetPasswordForEmail(profileUser.email, {
        redirectTo: undefined,
      });
      if (error) throw error;
      setPwStep("code"); setResendCooldown(60);
    } catch (e: any) { setPwError(e?.message ?? "Помилка відправки"); setPwStep("idle"); }
  }
  async function verifyCode() {
    if (!/^\d{6}$/.test(code)) return setPwError("Введіть 6-значний код");
    setPwError(null); setPwStep("verifying");
    try {
      const { error } = await supabase.auth.verifyOtp({ email: profileUser.email, token: code, type: "recovery" });
      if (error) throw error;
      setPwStep("newpw");
    } catch { setPwError("Невірний або застарілий код."); setPwStep("code"); }
  }
  async function setPassword() {
    if (newPw.length < 8) return setPwError("Мінімум 8 символів");
    if (newPw !== confirmPw) return setPwError("Паролі не співпадають");
    setPwError(null); setPwStep("verifying");
    try {
      const { error } = await supabase.auth.updateUser({ password: newPw });
      if (error) throw error;
      setPwStep("done"); setCode(""); setNewPw(""); setConfirmPw("");
    } catch (e: any) { setPwError(e?.message ?? "Помилка"); setPwStep("newpw"); }
  }
  function resetPw() { setPwStep("idle"); setCode(""); setNewPw(""); setConfirmPw(""); setPwError(null); setShowPwModal(false); onModalChange?.(false); }

  const inputClass = "w-full px-4 py-3 rounded-xl border border-(--brd) bg-(--bg) text-(--t1) text-sm font-medium focus:ring-2 focus:ring-blue-500/30 focus:border-blue-600 outline-none transition-all";
  const codeIsValid = /^\d{6}$/.test(code);

  return (
    <div className="space-y-5">
    <div className="space-y-3">
    <h3 className="text-xs font-black uppercase tracking-widest text-(--t2) flex items-center gap-2"><Pencil size={12} /> Редагування профілю</h3>
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
    {saveError && <div className="flex items-center gap-2 p-3 rounded-xl bg-red-500/10 border border-red-500/20 text-red-500 text-xs font-bold"><AlertCircle size={14} className="flex-shrink-0" /> {saveError}</div>}
    <div className="flex gap-2">
    <button onClick={handleSave} disabled={saving || !username.trim() || !login.trim()}
    className="flex items-center gap-2 bg-blue-600 text-white font-black text-xs uppercase tracking-widest rounded-xl px-5 py-3 hover:bg-blue-700 active:scale-95 transition-all disabled:opacity-40 shadow-lg shadow-blue-600/20">
    {saving ? <Loader size={13} className="animate-spin" /> : <Save size={13} />} {saving ? "Збереження..." : "Зберегти"}
    </button>
    <button onClick={onCancel} className="flex items-center gap-2 border border-(--brd) text-(--t2) font-black text-xs uppercase tracking-widest rounded-xl px-4 py-3 hover:border-red-500/40 hover:text-red-500 active:scale-95 transition-all">
    <X size={13} /> Скасувати
    </button>
    </div>
    </div>
    <div className="border-t border-(--brd)" />

    {/* ── Change Password — trigger ── */}
    <div className="rounded-2xl border border-(--brd) overflow-hidden" style={{ background: "var(--card)" }}>
      <div className="flex items-center gap-3 px-5 py-3.5 border-b border-(--brd)" style={{ background: "var(--card)" }}>
        <div className="w-7 h-7 rounded-xl bg-blue-600/10 border border-blue-600/20 flex items-center justify-center flex-shrink-0">
          <KeyRound size={13} className="text-blue-600" />
        </div>
        <p className="text-xs font-black uppercase tracking-widest text-(--t1)">Зміна пароля</p>
      </div>
      <div className="p-5 space-y-3">
        <p className="text-xs font-medium text-(--t2)">
          Код підтвердження надійде на{" "}
          <span className="font-black text-(--t1)">{profileUser.email}</span>
        </p>
        <button
          onClick={() => { setPwStep("sending"); setShowPwModal(true); onModalChange?.(true); sendCode(); }}
          className="group w-full relative flex items-center justify-center gap-2.5 overflow-hidden rounded-2xl px-4 py-3.5 font-black text-xs uppercase tracking-widest transition-all duration-300 active:scale-95 shadow-lg shadow-blue-600/20 border border-blue-500/30"
          style={{ background: "linear-gradient(135deg, #2563eb 0%, #1d4ed8 50%, #3b82f6 100%)", color: "white" }}
        >
          {/* shimmer effect */}
          <span className="absolute inset-0 translate-x-[-100%] group-hover:translate-x-[100%] transition-transform duration-700 bg-gradient-to-r from-transparent via-white/10 to-transparent skew-x-12" />
          <span className="relative flex items-center gap-2 drop-shadow">
            <KeyRound size={14} />
            <span className="tracking-[0.15em]">Змінити пароль</span>
          </span>
        </button>
      </div>
    </div>

    {/* ── Password Modal ── */}
    {showPwModal && typeof document !== "undefined" && createPortal(
      <>
        <style>{`
          @keyframes pwSlideUp { from { opacity:0; transform:translateY(20px) scale(0.95); } to { opacity:1; transform:translateY(0) scale(1); } }
          .pw-modal-card { animation: pwSlideUp 0.5s cubic-bezier(0.22,1,0.36,1) forwards; }
        `}</style>

        {/* Full-screen overlay — covers EVERYTHING including sidebar */}
        <div
          className="fixed inset-0 z-[9998]"
          style={{
            backdropFilter: "blur(8px)",
            WebkitBackdropFilter: "blur(8px)",
            background: "rgba(0,0,0,0.6)",
          }}
          onClick={resetPw}
        />

        {/* Centering wrapper */}
        <div className="fixed inset-0 z-[9999] flex items-center justify-center p-4 pointer-events-none">
        <div className="pw-modal-card pointer-events-auto w-full max-w-sm bg-(--card)/80 backdrop-blur-3xl rounded-[2.5rem] shadow-2xl border border-(--brd) flex flex-col items-center text-(--t1) overflow-hidden">

          {/* Modal header */}
          <div className="w-full flex items-center justify-between px-7 py-4 border-b border-(--brd)">
            <div className="flex items-center gap-2.5">
              <KeyRound size={14} className="text-blue-500" />
              <span className="text-xs font-black uppercase tracking-widest text-(--t1)">Зміна пароля</span>
            </div>
            <button onClick={resetPw} className="w-7 h-7 rounded-xl border border-(--brd) bg-(--bg) flex items-center justify-center text-(--t2) hover:text-red-500 hover:border-red-500/40 transition-all active:scale-95">
              <X size={13} />
            </button>
          </div>

          <div className="w-full flex flex-col items-center p-10">

          {/* Sending */}
          {pwStep === "sending" && (
            <div className="flex flex-col items-center gap-4 py-4">
              <div className="w-16 h-16 bg-blue-600/10 rounded-2xl flex items-center justify-center text-blue-600">
                <Loader size={32} className="animate-spin" />
              </div>
              <p className="text-xs font-black uppercase tracking-widest text-(--t2)">Надсилання коду...</p>
            </div>
          )}

          {/* Code input step */}
          {pwStep === "code" && (
            <>
              <div className="w-16 h-16 bg-blue-600/10 rounded-2xl flex items-center justify-center text-blue-600 mb-6">
                <Mail size={32} />
              </div>
              <h2 className="text-2xl font-black text-(--t1) uppercase mb-2 tracking-tight">Verify</h2>
              <p className="text-center text-(--t2) text-[10px] font-bold uppercase mb-8 leading-relaxed">
                Введіть 6-значний код надісланий на<br />
                <span className="text-(--t1) font-black">{profileUser.email}</span>
              </p>

              <input
                type="text"
                maxLength={6}
                value={code}
                onChange={e => { setCode(e.target.value.replace(/\D/g, "")); setPwError(null); }}
                placeholder="000000"
                className="w-full text-center text-4xl font-black tracking-[0.2em] py-5 rounded-2xl bg-(--bg)/50 focus:bg-(--card) focus:ring-2 focus:ring-blue-500 outline-none transition-all text-blue-600 mb-4 placeholder:text-(--t2)/30 border border-(--brd)"
              />

              {pwError && (
                <div className="w-full mb-4 px-4 py-3 rounded-2xl bg-red-500/10 border border-red-500/20 text-red-500 text-[11px] font-bold text-center">
                  {pwError}
                </div>
              )}

              <button
                onClick={verifyCode}
                disabled={code.length !== 6}
                className={`w-full py-5 rounded-[1.8rem] font-black uppercase shadow-lg transition-all active:scale-95 mb-4 text-sm tracking-wider ${
                  code.length === 6
                    ? "bg-blue-600 text-white hover:bg-blue-700 shadow-blue-500/20"
                    : "bg-(--brd) text-(--t2) cursor-not-allowed"
                }`}
              >
                Підтвердити
              </button>

              <div className="flex items-center justify-between w-full">
                <button
                  onClick={() => { if (resendCooldown === 0) sendCode(); }}
                  disabled={resendCooldown > 0}
                  className="flex items-center gap-1.5 text-[10px] font-black uppercase tracking-[0.2em] text-(--t2) hover:text-blue-600 transition-colors disabled:opacity-40"
                >
                  <RefreshCw size={10} />
                  {resendCooldown > 0 ? `Повторно через ${resendCooldown}с` : "Надіслати ще раз"}
                </button>
                <button onClick={resetPw} className="text-[10px] font-black text-(--t2) hover:text-red-500 uppercase tracking-[0.2em] transition-all flex items-center gap-1.5">
                  <span>←</span> Назад
                </button>
              </div>
            </>
          )}

          {/* Verifying */}
          {pwStep === "verifying" && (
            <div className="flex flex-col items-center gap-4 py-4">
              <div className="w-16 h-16 bg-blue-600/10 rounded-2xl flex items-center justify-center text-blue-600">
                <Loader size={32} className="animate-spin" />
              </div>
              <p className="text-xs font-black uppercase tracking-widest text-(--t2)">Перевірка...</p>
            </div>
          )}

          {/* New password step */}
          {pwStep === "newpw" && (
            <>
              <div className="w-16 h-16 bg-green-500/10 rounded-2xl flex items-center justify-center text-green-500 mb-6">
                <Lock size={28} />
              </div>
              <h2 className="text-2xl font-black text-(--t1) uppercase mb-2 tracking-tight">Новий пароль</h2>
              <p className="text-center text-(--t2) text-[10px] font-bold uppercase mb-6">Встановіть новий пароль для вашого акаунту</p>

              <div className="w-full space-y-3">
                <div className="relative">
                  <input
                    type={showPw ? "text" : "password"}
                    value={newPw}
                    onChange={e => setNewPw(e.target.value)}
                    placeholder="Мінімум 8 символів..."
                    className="w-full px-5 py-4 pr-12 rounded-2xl border border-(--brd) bg-(--bg)/50 focus:ring-2 focus:ring-blue-500 focus:bg-(--card) outline-none text-sm text-(--t1) transition-all"
                  />
                  <button type="button" onClick={() => setShowPw(p => !p)} className="absolute right-4 top-1/2 -translate-y-1/2 text-(--t2) hover:text-blue-600 transition-colors">
                    {showPw ? <EyeOff size={16} /> : <Eye size={16} />}
                  </button>
                </div>
                {newPw && pwStrength !== null && (
                  <div className="space-y-1 px-1">
                    <div className="flex gap-1">
                      {[1,2,3,4].map(i => (
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
                <div className="relative">
                  <input
                    type={showConfirm ? "text" : "password"}
                    value={confirmPw}
                    onChange={e => setConfirmPw(e.target.value)}
                    placeholder="Повторіть пароль..."
                    className={`w-full px-5 py-4 pr-12 rounded-2xl border bg-(--bg)/50 focus:ring-2 focus:bg-(--card) outline-none text-sm text-(--t1) transition-all ${
                      confirmPw && confirmPw !== newPw
                        ? "border-red-500 focus:ring-red-500/30"
                        : confirmPw && confirmPw === newPw
                        ? "border-green-500 focus:ring-green-500/30"
                        : "border-(--brd) focus:ring-blue-500"
                    }`}
                  />
                  <button type="button" onClick={() => setShowConfirm(p => !p)} className="absolute right-4 top-1/2 -translate-y-1/2 text-(--t2) hover:text-blue-600 transition-colors">
                    {showConfirm ? <EyeOff size={16} /> : <Eye size={16} />}
                  </button>
                  {confirmPw && confirmPw === newPw && (
                    <CheckCircle size={15} className="absolute right-12 top-1/2 -translate-y-1/2 text-green-500" />
                  )}
                </div>

                {pwError && (
                  <div className="px-4 py-3 rounded-2xl bg-red-500/10 border border-red-500/20 text-red-500 text-[11px] font-bold text-center">
                    {pwError}
                  </div>
                )}

                <button
                  onClick={setPassword}
                  disabled={!newPw || !confirmPw || newPw !== confirmPw || newPw.length < 8}
                  className={`w-full py-5 rounded-[1.8rem] font-black uppercase shadow-lg transition-all active:scale-95 text-sm tracking-wider ${
                    newPw && confirmPw && newPw === confirmPw && newPw.length >= 8
                      ? "bg-blue-600 text-white hover:bg-blue-700 shadow-blue-500/20"
                      : "bg-(--brd) text-(--t2) cursor-not-allowed"
                  }`}
                >
                  Встановити пароль
                </button>
                <button onClick={resetPw} className="w-full text-[10px] font-black text-(--t2) hover:text-red-500 uppercase tracking-[0.2em] transition-all flex items-center justify-center gap-1.5">
                  <span>←</span> Скасувати
                </button>
              </div>
            </>
          )}

          {/* Done */}
          {pwStep === "done" && (
            <>
              <div className="w-16 h-16 bg-green-500/10 rounded-2xl flex items-center justify-center mb-6">
                <CheckCircle size={32} className="text-green-500" />
              </div>
              <h2 className="text-2xl font-black text-(--t1) uppercase mb-2 tracking-tight">Готово!</h2>
              <p className="text-center text-(--t2) text-[10px] font-bold uppercase mb-8">Пароль успішно змінено</p>
              <button onClick={resetPw} className="w-full py-5 rounded-[1.8rem] bg-blue-600 text-white font-black uppercase shadow-lg hover:bg-blue-700 active:scale-95 transition-all text-sm tracking-wider shadow-blue-500/20">
                Закрити
              </button>
            </>
          )}

          </div>{/* end inner content */}
        </div>{/* end modal card */}
        </div>{/* end centering wrapper */}
      </>,
      document.body
    )}
    </div>
  );
}


// ── Notification card (compact for profile) ───────────────────────────────────
function NotificationCard({
  notif, idx, responded, responding, onAccept, onDecline, onMarkRead, onGoTeam,
}: {
  notif: Notification; idx: number; responded: "accepted" | "declined" | undefined;
  responding: "accept" | "decline" | null;
  onAccept: () => void; onDecline: () => void; onMarkRead: () => void; onGoTeam: (id: string) => void;
}) {
  const meta     = parseMeta(notif.meta);
  const isInvite = notif.type === "team_invitation";
  const borderClass = typeBorder[notif.type] ?? "border-l-gray-400";
  return (
    <div className={`fuIn bg-(--bg) rounded-xl border border-(--brd) border-l-4 ${borderClass} p-3.5 transition-all ${!notif.read ? "shadow-sm" : "opacity-60"}`} style={{ animationDelay: `${idx * 40}ms` }}>
    <div className="flex items-start gap-3">
    <div className={`w-7 h-7 rounded-lg flex items-center justify-center flex-shrink-0 ${notif.type === "team_invitation" ? "bg-blue-500/10 border border-blue-500/20" : notif.type === "invitation_accepted" ? "bg-green-500/10 border border-green-500/20" : notif.type === "jury_invitation" ? "bg-amber-500/10 border border-amber-500/20" : "bg-red-500/10 border border-red-500/20"}`}>
    {typeIcon[notif.type] ?? <Bell size={13} className="text-(--t2)" />}
    </div>
    <div className="flex-1 min-w-0">
    <div className="flex items-start justify-between gap-2">
    <p className={`text-[11px] font-black uppercase tracking-wide leading-tight ${notif.read ? "text-(--t2)" : "text-(--t1)"}`}>{notif.title}</p>
    {!notif.read && <button onClick={onMarkRead} className="w-2 h-2 rounded-full bg-blue-500 flex-shrink-0 mt-1 hover:bg-blue-700 transition-colors" />}
    </div>
    <p className="text-[10px] font-bold text-(--t2) mt-0.5 leading-relaxed">{notif.message}</p>
    {meta.team_id && <button onClick={() => onGoTeam(meta.team_id!)} className="mt-1.5 flex items-center gap-1 text-[9px] font-black uppercase tracking-widest text-blue-500 hover:text-blue-400 transition-colors"><Users size={9} /> {meta.team_name} <ChevronRight size={8} /></button>}
    <p className="mt-1 text-[9px] font-black uppercase tracking-widest text-(--t2) opacity-50">{timeAgo(notif.created_at)}</p>
    {isInvite && !responded && (
      <div className="flex items-center gap-1.5 mt-2.5">
      <button onClick={onAccept} disabled={!!responding} className="flex items-center gap-1 px-3 py-1.5 rounded-lg bg-blue-600 text-white font-black text-[10px] uppercase tracking-widest hover:bg-blue-700 active:scale-95 transition-all disabled:opacity-60">
      {responding === "accept" ? <Loader size={10} className="animate-spin" /> : <Check size={10} />} Прийняти
      </button>
      <button onClick={onDecline} disabled={!!responding} className="flex items-center gap-1 px-3 py-1.5 rounded-lg bg-(--card) border border-(--brd) text-(--t2) font-black text-[10px] uppercase tracking-widest hover:border-red-500/40 hover:text-red-500 active:scale-95 transition-all disabled:opacity-60">
      {responding === "decline" ? <Loader size={10} className="animate-spin" /> : <X size={10} />} Відхилити
      </button>
      </div>
    )}
    {isInvite && responded && (
      <div className={`mt-2 inline-flex items-center gap-1 px-2.5 py-1 rounded-md text-[9px] font-black uppercase tracking-widest border ${responded==="accepted"?"bg-green-500/10 text-green-500 border-green-500/20":"bg-red-500/10 text-red-500 border-red-500/20"}`}>
      {responded === "accepted" ? <><Check size={9} /> Прийнято</> : <><X size={9} /> Відхилено</>}
      </div>
    )}
    </div>
    </div>
    </div>
  );
}

// ── Jury Panel ─────────────────────────────────────────────────────────────────
function JuryProfilePanel({ juryTournaments, juryRounds, jurySubmissions, loading, router }: {
  juryTournaments: JuryTournament[];
  juryRounds: JuryRound[];
  jurySubmissions: JurySubmission[];
  loading: boolean;
  router: ReturnType<typeof useRouter>;
}) {
  const invStatusStyle: Record<string, string> = {
    accepted: "text-green-500 bg-green-500/10 border-green-500/20",
    pending:  "text-amber-500 bg-amber-500/10 border-amber-500/20",
    declined: "text-(--t2) bg-(--bg) border-(--brd)",
  };
  const invStatusLabel: Record<string, string> = {
    accepted: "Залучений", pending: "Очікує", declined: "Відхилено",
  };
  const roundStatusStyle: Record<string, string> = {
    active:   "text-green-500 bg-green-500/10 border-green-500/20",
    pending:  "text-amber-500 bg-amber-500/10 border-amber-500/20",
    finished: "text-(--t2) bg-(--bg) border-(--brd)",
  };

  if (loading) return (
    <div className="flex items-center justify-center py-10">
    <Loader className="w-6 h-6 text-amber-500 animate-spin" />
    </div>
  );

  return (
    <div className="space-y-5">

    {/* Tournaments */}
    <section className="bg-(--card) rounded-2xl sm:rounded-[2.5rem] shadow-sm border border-amber-500/30 overflow-hidden">
    <div className="flex items-center gap-3 px-5 sm:px-7 py-3.5 border-b border-(--brd) bg-amber-500/5">
    <div className="w-7 h-7 rounded-xl bg-amber-500/10 text-amber-500 flex items-center justify-center flex-shrink-0"><Trophy size={14} /></div>
    <div>
    <p className="text-xs font-black uppercase tracking-widest text-amber-500">Турніри (журі)</p>
    {juryTournaments.length > 0 && <p className="text-[10px] font-bold text-(--t2) mt-0.5">{juryTournaments.length} турнірів</p>}
    </div>
    </div>
    <div className="p-5 sm:p-7">
    {juryTournaments.length === 0 ? (
      <div className="text-center py-5">
      <Trophy className="w-10 h-10 text-(--t2) opacity-30 mx-auto mb-2" />
      <p className="text-[11px] font-bold text-(--t2) uppercase tracking-wider">Ще не залучені до жодного турніру</p>
      </div>
    ) : (
      <div className="space-y-2">
      {juryTournaments.map(t => (
        <button key={t.id} onClick={() => router.push(`/tournaments/${t.id}`)}
        className="w-full flex items-center gap-3 p-3.5 rounded-2xl border border-(--brd) bg-(--bg) hover:border-amber-500/40 hover:bg-amber-500/5 transition-all group text-left">
        <div className="w-9 h-9 rounded-xl bg-amber-500/10 border border-amber-500/20 flex items-center justify-center text-amber-500 flex-shrink-0"><Trophy size={15} /></div>
        <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 flex-wrap">
        <span className="font-black text-(--t1) text-sm truncate group-hover:text-amber-500 transition-colors">{t.name}</span>
        <span className={`text-[8px] font-black uppercase px-1.5 py-0.5 rounded-md border flex-shrink-0 ${invStatusStyle[t.invitation_status] ?? invStatusStyle.pending}`}>
        {invStatusLabel[t.invitation_status] ?? t.invitation_status}
        </span>
        </div>
        {t.start_at && <p className="text-[9px] font-bold text-(--t2) mt-0.5 opacity-60">Старт: {new Date(t.start_at).toLocaleDateString("uk-UA")}</p>}
        </div>
        <ExternalLink size={13} className="text-(--t2) flex-shrink-0 opacity-0 group-hover:opacity-100 transition-opacity" />
        </button>
      ))}
      </div>
    )}
    </div>
    </section>

    {/* Rounds */}
    {juryRounds.length > 0 && (
      <section className="bg-(--card) rounded-2xl sm:rounded-[2.5rem] shadow-sm border border-(--brd) overflow-hidden">
      <div className="flex items-center gap-3 px-5 sm:px-7 py-3.5 border-b border-(--brd) bg-(--bg)/40">
      <div className="w-7 h-7 rounded-xl bg-blue-600/10 text-blue-600 flex items-center justify-center flex-shrink-0"><Flag size={14} /></div>
      <p className="text-xs font-black uppercase tracking-widest text-(--t1)">Раунди ({juryRounds.length})</p>
      </div>
      <div className="p-5 sm:p-7 space-y-2">
      {juryRounds.map(r => (
        <button key={r.id} onClick={() => router.push(`/jury/rounds/${r.id}/evaluate`)}
        className="w-full flex items-center gap-3 p-3 rounded-xl border border-(--brd) bg-(--bg) hover:border-blue-600/40 hover:bg-blue-600/5 transition-all group text-left">
        <div className="w-7 h-7 rounded-lg bg-blue-600/10 border border-blue-600/20 flex items-center justify-center text-blue-600 font-black text-xs flex-shrink-0">{r.number}</div>
        <div className="flex-1 min-w-0">
        <p className="text-xs font-black text-(--t1) truncate group-hover:text-blue-600 transition-colors">{r.name || `Раунд ${r.number}`}</p>
        <p className="text-[10px] font-bold text-(--t2) truncate">{r.tournament_name}</p>
        </div>
        {r.status && <span className={`text-[8px] font-black uppercase px-1.5 py-0.5 rounded-md border flex-shrink-0 ${roundStatusStyle[r.status] ?? roundStatusStyle.pending}`}>{r.status === "active" ? "Активний" : r.status === "finished" ? "Завершено" : "Очікується"}</span>}
        <ExternalLink size={12} className="text-(--t2) flex-shrink-0 opacity-0 group-hover:opacity-100 transition-opacity" />
        </button>
      ))}
      </div>
      </section>
    )}

    {/* Submissions */}
    {jurySubmissions.length > 0 && (
      <section className="bg-(--card) rounded-2xl sm:rounded-[2.5rem] shadow-sm border border-(--brd) overflow-hidden">
      <div className="flex items-center gap-3 px-5 sm:px-7 py-3.5 border-b border-(--brd) bg-(--bg)/40">
      <div className="w-7 h-7 rounded-xl bg-purple-500/10 text-purple-500 flex items-center justify-center flex-shrink-0"><FileText size={14} /></div>
      <p className="text-xs font-black uppercase tracking-widest text-(--t1)">Роботи для оцінки ({jurySubmissions.length})</p>
      </div>
      <div className="p-5 sm:p-7 space-y-2">
      {jurySubmissions.map(s => (
        <button key={s.id} onClick={() => router.push(`/jury/rounds/${s.round_id}/evaluate`)}
        className="w-full flex items-center gap-3 p-3 rounded-xl border border-(--brd) bg-(--bg) hover:border-purple-500/40 hover:bg-purple-500/5 transition-all group text-left">
        <div className="w-7 h-7 rounded-lg bg-purple-500/10 border border-purple-500/20 flex items-center justify-center text-purple-500 flex-shrink-0"><FileText size={12} /></div>
        <div className="flex-1 min-w-0">
        <p className="text-xs font-black text-(--t1) truncate group-hover:text-purple-500 transition-colors">{s.team_name}</p>
        <p className="text-[10px] font-bold text-(--t2)">{new Date(s.submitted_at).toLocaleDateString("uk-UA", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" })}</p>
        </div>
        <span className={`text-[8px] font-black uppercase px-1.5 py-0.5 rounded-md border flex-shrink-0 ${s.status === "submitted" ? "text-green-500 bg-green-500/10 border-green-500/20" : "text-(--t2) bg-(--bg) border-(--brd)"}`}>
        {s.status === "submitted" ? "Здано" : s.status}
        </span>
        <ExternalLink size={12} className="text-(--t2) flex-shrink-0 opacity-0 group-hover:opacity-100 transition-opacity" />
        </button>
      ))}
      </div>
      </section>
    )}
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
  const [isPwModalOpen, setIsPwModalOpen] = useState(false);

  const isJury = currentUser?.role === "jury";
  const { teams: userTeams, loading: teamsLoading } = useUserTeams(isJury ? undefined : currentUser?.id);
  const { juryTournaments, juryRounds, jurySubmissions, loading: juryLoading } = useJuryData(currentUser?.id, isJury);

  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [notifLoading, setNotifLoading]   = useState(true);
  const [responding, setResponding]       = useState<Record<string, "accept" | "decline" | null>>({});
  const [responded, setResponded]         = useState<Record<string, "accepted" | "declined">>({});
  const [tournaments, setTournaments]     = useState<Tournament[]>([]);
  const [tourLoading, setTourLoading]     = useState(true);

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
    if (isJury) { setTourLoading(false); return; } // журі не має командних турнірів
    setTourLoading(true);
    try {
      const res = await fetch(`${API_URL}/api/users/me/tournaments`, { headers: authHeader() });
      if (res.ok) setTournaments((await res.json()).tournaments ?? []);
      else setTournaments([]);
    } catch { setTournaments([]); }
    finally { setTourLoading(false); }
  }, [authHeader, isJury]);

  useEffect(() => {
    if (authLoading) return;
    if (!currentUser) { router.push("/login"); return; }
    const fetchUser = async () => {
      setIsLoading(true);
      try {
        const { data, error } = await supabase.from("account").select("id, username, login, email, role, status, avatar_url").eq("id", currentUser.id).single();
        if (error) throw error;
        setProfileUser(data);
      } catch { setError("Користувача не знайдено"); }
      finally { setIsLoading(false); }
    };
    fetchUser();
    fetchNotifications();
    fetchTournaments();
  }, [authLoading, currentUser, router, fetchNotifications, fetchTournaments]);

  const markAllRead = async () => {
    await fetch(`${API_URL}/api/notifications/mark-read`, { method: "POST", headers: authHeader(), body: JSON.stringify({ all: true }) });
    setNotifications(prev => prev.map(n => ({ ...n, read: true })));
  };
  const markRead = async (id: string) => {
    await fetch(`${API_URL}/api/notifications/mark-read`, { method: "POST", headers: authHeader(), body: JSON.stringify({ ids: [id] }) });
    setNotifications(prev => prev.map(n => n.id === id ? { ...n, read: true } : n));
  };
  const respondInvitation = async (notif: Notification, accept: boolean) => {
    const meta = parseMeta(notif.meta); const invitationId = meta.invitation_id;
    if (!invitationId) return;
    const key = notif.id;
    setResponding(prev => ({ ...prev, [key]: accept ? "accept" : "decline" }));
    try {
      const res = await fetch(`${API_URL}/api/invitations/respond`, { method: "POST", headers: authHeader(), body: JSON.stringify({ invitation_id: invitationId, accept }) });
      if (!res.ok) { const err = await res.json(); alert(err.detail ?? "Помилка відповіді"); return; }
      setResponded(prev => ({ ...prev, [key]: accept ? "accepted" : "declined" }));
      await markRead(notif.id);
    } catch { alert("Помилка з'єднання з сервером"); }
    finally { setResponding(prev => ({ ...prev, [key]: null })); }
  };

  const unreadCount = notifications.filter(n => !n.read).length;

  const allReady = !isLoading && (isJury ? !juryLoading : (!teamsLoading && !tourLoading)) && !notifLoading;
  const [visible, setVisible] = useState(false);
  useEffect(() => {
    if (allReady) { const t = setTimeout(() => setVisible(true), 50); return () => clearTimeout(t); }
  }, [allReady]);

  if (authLoading) return <div className="min-h-screen bg-(--bg) flex items-center justify-center"><div className="w-8 h-8 border-2 border-blue-600 border-t-transparent rounded-full animate-spin" /></div>;
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

    {isMobileSidebarOpen && <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-40 lg:hidden" onClick={() => setIsMobileSidebarOpen(false)} />}
    <div className={`fixed inset-y-0 left-0 z-50 lg:relative lg:translate-x-0 transition-transform duration-300 ease-in-out ${isMobileSidebarOpen ? "translate-x-0" : "-translate-x-full lg:translate-x-0"}`}>
    <Sidebar />
    </div>

    <main className={`flex-1 flex flex-col min-w-0 overflow-hidden transition-all duration-300 ${isPwModalOpen ? "blur-sm brightness-75" : ""}`}>
    <MobileHeader onOpenSidebar={() => setIsMobileSidebarOpen(true)} title="Профіль" icon={<UserCircle size={18} className="text-blue-600" />} />
    <div className={`flex-1 overflow-y-auto p-4 sm:p-6 md:p-8 relative z-10 ${allReady ? "page-ready" : ""}`}>

    <nav className="flex items-center gap-2 text-[10px] font-black mb-5 uppercase tracking-widest text-(--t2)">
    <button onClick={() => router.push("/")} className="hover:text-blue-600 transition-colors">Головна</button>
    <ChevronRight size={10} /><span className="text-(--t1)">Профіль</span>
    </nav>
    <button onClick={() => router.back()} className="mb-5 flex items-center gap-2 text-[11px] font-black uppercase tracking-widest text-(--t2) hover:text-blue-600 transition-colors">
    <ArrowLeft size={14} /> Назад
    </button>

    {!allReady && !error && (
      <div className="fixed inset-0 z-50 flex items-center justify-center pointer-events-none">
      <div className="flex flex-col items-center gap-3">
      <div className="w-10 h-10 border-2 border-blue-600 border-t-transparent rounded-full animate-spin" />
      <p className="text-[10px] font-black uppercase tracking-widest text-blue-600 opacity-70">Завантаження...</p>
      </div>
      </div>
    )}

    {error ? (
      <p className="text-lg font-black text-(--t1)">{error}</p>
    ) : (
      <div className="flex flex-col xl:flex-row gap-6 items-start w-full">

      {/* ── LEFT COLUMN ── */}
      <div className="flex flex-col gap-5 w-full xl:flex-1 min-w-0">

      {/* Profile card */}
      <section className="fade-up bg-(--card) rounded-2xl sm:rounded-[2.5rem] shadow-sm border border-(--brd) p-5 sm:p-7 relative overflow-hidden">
      <div className="absolute right-0 top-0 opacity-5 pointer-events-none text-(--t1) hidden md:block"><Shield size={220} /></div>
      {isLoading ? (
        <div className="flex flex-col sm:flex-row items-center sm:items-start gap-5 animate-pulse">
        <div className="w-[88px] h-[88px] rounded-full flex-shrink-0" style={{background:"var(--brd)"}} />
        <div className="flex-1 space-y-3 w-full">
        <div className="h-6 w-36 rounded-xl" style={{background:"var(--brd)"}} />
        <div className="h-4 w-48 rounded-lg" style={{background:"var(--brd)"}} />
        <div className="h-4 w-44 rounded-lg" style={{background:"var(--brd)"}} />
        </div>
        </div>
      ) : (
        <div className="flex flex-col sm:flex-row items-center sm:items-stretch gap-6">
        <div className="flex flex-col items-center justify-center flex-shrink-0">
        <div className="relative group">
        <div className="rounded-full bg-blue-600/10 flex items-center justify-center border-4 border-(--brd) shadow-md overflow-hidden" style={{ width: 120, height: 120 }}>
        {profileUser?.avatar_url ? <img src={profileUser.avatar_url} alt="avatar" className="w-full h-full object-cover" /> : <span className="text-4xl font-black text-blue-600">{profileUser?.username?.charAt(0).toUpperCase() ?? "?"}</span>}
        </div>
        {profileUser?.status === "active" && <span className="absolute bottom-1.5 right-1.5 w-4 h-4 bg-green-500 border-4 border-(--card) rounded-full shadow-sm" />}
        <button onClick={() => setShowAvatarEditor(true)} className="absolute inset-0 flex items-center justify-center rounded-full bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity" style={{ width: 120, height: 120 }}>
        <Pencil size={18} className="text-white" />
        </button>
        </div>
        </div>
        <div className="flex-1 flex flex-col justify-center space-y-2.5 z-10 w-full text-left">
        <div className="flex flex-row items-center justify-between gap-2">
        <h1 className="text-xl font-black text-(--t1) uppercase tracking-tight">{profileUser?.username}</h1>
        {!isEditing && (
          <button onClick={() => setIsEditing(true)} className="flex items-center gap-1.5 border border-(--brd) text-(--t2) font-black text-[10px] uppercase tracking-widest rounded-xl px-3 py-2 hover:border-blue-600/40 hover:text-blue-600 active:scale-95 transition-all">
          <Pencil size={11} /> Редагувати
          </button>
        )}
        </div>
        <div className="flex items-center gap-2 flex-wrap">
        <span className="text-[9px] font-black uppercase bg-blue-500/10 text-blue-500 border border-blue-500/20 px-2.5 py-1 rounded-lg">Ваш профіль</span>
        <span className={`text-[9px] font-black uppercase px-2.5 py-1 rounded-lg border ${roleBadgeColor[profileUser?.role as Role] ?? roleBadgeColor.user}`}>{profileUser?.role ?? "user"}</span>
        {isJury && <span className="text-[9px] font-black uppercase bg-amber-500/10 text-amber-500 border border-amber-500/20 px-2.5 py-1 rounded-lg flex items-center gap-1"><Star size={9} className="fill-amber-500" /> Журі</span>}
        </div>
        <div className="space-y-2 text-sm">
        <p className="flex items-center gap-2.5 font-medium"><User size={14} className="text-blue-600 flex-shrink-0" /><span className="text-(--t2) text-xs w-10 flex-shrink-0">Ім'я:</span><span className="font-bold text-sm">{profileUser?.username}</span></p>
        <p className="flex items-center gap-2.5 font-medium"><User size={14} className="text-blue-600 flex-shrink-0" /><span className="text-(--t2) text-xs w-10 flex-shrink-0">Логін:</span><span className="font-bold text-sm">{profileUser?.login}</span></p>
        <p className="flex items-center gap-2.5 font-medium"><Mail size={14} className="text-blue-600 flex-shrink-0" /><span className="text-(--t2) text-xs w-10 flex-shrink-0">Email:</span><span className="font-bold text-sm break-all">{profileUser?.email}</span></p>
        <p className="flex items-center gap-2.5 font-medium"><Shield size={14} className="text-blue-600 flex-shrink-0" /><span className="text-(--t2) text-xs w-10 flex-shrink-0">Роль:</span><span className={`text-[9px] font-black uppercase px-2 py-0.5 rounded-md border ${roleBadgeColor[profileUser?.role as Role] ?? roleBadgeColor.user}`}>{profileUser?.role ?? "user"}</span></p>
        </div>
        <div className="pt-2.5 border-t border-(--brd) text-[9px] font-bold uppercase tracking-widest text-(--t2)">ID: {profileUser?.id}</div>
        </div>
        </div>
      )}
      {isEditing && profileUser && (
        <div className="mt-5 pt-5 border-t border-(--brd)">
        <EditProfileSection
        profileUser={profileUser}
        onSave={({ username, login }) => { setProfileUser((prev: any) => ({ ...prev, username, login })); setIsEditing(false); }}
        onCancel={() => setIsEditing(false)}
        onModalChange={setIsPwModalOpen}
        />
        </div>
      )}
      </section>

      {/* JURY: show jury-specific panel; OTHERS: show teams + tournaments */}
      {isJury ? (
        <div className="fade-up-1">
        <JuryProfilePanel
        juryTournaments={juryTournaments}
        juryRounds={juryRounds}
        jurySubmissions={jurySubmissions}
        loading={juryLoading}
        router={router}
        />
        </div>
      ) : (
        <>
        {/* Teams */}
        <section className="fade-up-1 bg-(--card) rounded-2xl sm:rounded-[2.5rem] shadow-sm border border-(--brd) overflow-hidden">
        <div className="flex items-center gap-3 px-5 sm:px-7 py-3.5 border-b border-(--brd) bg-(--bg)/[40]">
        <div className="w-7 h-7 rounded-xl bg-blue-600/10 text-blue-600 flex items-center justify-center flex-shrink-0"><Users size={14} /></div>
        <div>
        <p className="text-xs font-black uppercase tracking-widest text-(--t1)">Команди</p>
        {!teamsLoading && userTeams.length > 0 && <p className="text-[10px] font-bold text-(--t2) mt-0.5">{userTeams.length} команд</p>}
        </div>
        </div>
        <div className="p-5 sm:p-7">
        {teamsLoading ? (
          <div className="space-y-2">{[1,2].map(i => <div key={i} className="h-[60px] rounded-2xl animate-pulse" style={{background:"var(--brd)"}} />)}</div>
        ) : userTeams.length === 0 ? (
          <div className="text-center py-5">
          <div className="w-10 h-10 rounded-2xl bg-(--bg) border border-(--brd) flex items-center justify-center mx-auto mb-2"><Users className="w-5 h-5 text-(--t2) opacity-40" /></div>
          <p className="text-[11px] font-bold text-(--t2) uppercase tracking-wider">Не перебуває в жодній команді</p>
          <button onClick={() => router.push("/register_team")} className="mt-3 text-[10px] font-black uppercase tracking-widest text-blue-600 hover:underline">Створити команду →</button>
          </div>
        ) : (
          <div className="space-y-2">
          {userTeams.map(team => {
            const isCaptain = team.captain_id === profileUser?.id;
            const memberCount = team.members_ids?.length ?? 0;
            return (
              <button key={team.id} onClick={() => router.push("/teams/" + team.id)}
              className="w-full flex items-center gap-3 p-3.5 rounded-2xl border border-(--brd) bg-(--bg) hover:border-blue-600/40 hover:bg-blue-600/5 transition-all group text-left">
              <div className="w-9 h-9 rounded-xl bg-blue-600/10 border border-blue-600/20 flex items-center justify-center text-blue-600 font-black text-sm flex-shrink-0">{team.name.charAt(0).toUpperCase()}</div>
              <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 flex-wrap">
              <span className="font-black text-(--t1) text-sm truncate group-hover:text-blue-600 transition-colors">{team.name}</span>
              {isCaptain && <span className="text-[8px] font-black uppercase bg-amber-500/10 text-amber-500 border border-amber-500/20 px-1.5 py-0.5 rounded-md flex-shrink-0 flex items-center gap-1"><Crown size={7} /> Капітан</span>}
              </div>
              <div className="flex items-center gap-2 mt-0.5">
              {team.city_school_org && <span className="text-[10px] font-bold text-(--t2) truncate">{team.city_school_org}</span>}
              <span className="text-[10px] font-bold text-(--t2) flex items-center gap-1 flex-shrink-0"><Users size={8} /> {memberCount} уч.</span>
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

        {/* Tournaments (for non-jury) */}
        <section className="fade-up-2 bg-(--card) rounded-2xl sm:rounded-[2.5rem] shadow-sm border border-(--brd) overflow-hidden">
        <div className="flex items-center gap-3 px-5 sm:px-7 py-3.5 border-b border-(--brd) bg-(--bg)/[40]">
        <div className="w-7 h-7 rounded-xl bg-amber-500/10 text-amber-500 flex items-center justify-center flex-shrink-0"><Trophy size={14} /></div>
        <div>
        <p className="text-xs font-black uppercase tracking-widest text-(--t1)">Турніри</p>
        {!tourLoading && tournaments.length > 0 && <p className="text-[10px] font-bold text-(--t2) mt-0.5">{tournaments.length} турнірів</p>}
        </div>
        </div>
        <div className="p-5 sm:p-7">
        {tourLoading ? (
          <div className="space-y-2">{[1,2].map(i => <div key={i} className="h-[60px] rounded-2xl animate-pulse" style={{background:"var(--brd)"}} />)}</div>
        ) : tournaments.length === 0 ? (
          <div className="text-center py-5">
          <div className="w-10 h-10 rounded-2xl bg-(--bg) border border-(--brd) flex items-center justify-center mx-auto mb-2"><Trophy className="w-5 h-5 text-(--t2) opacity-40" /></div>
          <p className="text-[11px] font-bold text-(--t2) uppercase tracking-wider">Не бере участь у турнірах</p>
          <button onClick={() => router.push("/tournaments")} className="mt-3 text-[10px] font-black uppercase tracking-widest text-amber-500 hover:underline">Переглянути турніри →</button>
          </div>
        ) : (
          <div className="space-y-2">
          {tournaments.map((t, i) => {
            const st = t.status ?? "upcoming";
            return (
              <button key={t.id} onClick={() => router.push("/tournaments/" + t.id)}
              className="w-full flex items-center gap-3 p-3.5 rounded-2xl border border-(--brd) bg-(--bg) hover:border-amber-500/40 hover:bg-amber-500/5 transition-all group text-left" style={{ animationDelay: `${i * 40}ms` }}>
              <div className="w-9 h-9 rounded-xl bg-amber-500/10 border border-amber-500/20 flex items-center justify-center text-amber-500 flex-shrink-0"><Trophy size={15} /></div>
              <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 flex-wrap">
              <span className="font-black text-(--t1) text-sm truncate group-hover:text-amber-500 transition-colors">{t.name}</span>
              <span className={`text-[8px] font-black uppercase px-1.5 py-0.5 rounded-md border flex-shrink-0 ${tourStatusStyle[st] ?? tourStatusStyle.upcoming}`}>{tourStatusLabel[st] ?? st}</span>
              </div>
              {t.start_at && <p className="text-[9px] font-bold text-(--t2) mt-0.5 opacity-60">Початок: {new Date(t.start_at).toLocaleDateString("uk-UA")}</p>}
              </div>
              <ExternalLink size={13} className="text-(--t2) flex-shrink-0 opacity-0 group-hover:opacity-100 transition-opacity" />
              </button>
            );
          })}
          </div>
        )}
        </div>
        </section>
        </>
      )}
      </div>

      {/* ── RIGHT COLUMN — Notifications ── */}
      <div className="flex flex-col gap-5 w-full xl:w-[380px] flex-shrink-0">
      <section className="fade-up bg-(--card) rounded-2xl sm:rounded-[2.5rem] shadow-sm border border-(--brd) overflow-hidden">
      <div className="flex items-center justify-between gap-2 px-5 sm:px-6 py-3.5 border-b border-(--brd) bg-(--bg)/[40]">
      <div className="flex items-center gap-2.5">
      <div className="relative w-7 h-7 rounded-xl bg-blue-600/10 text-blue-600 flex items-center justify-center flex-shrink-0">
      <Bell size={14} />
      {unreadCount > 0 && <span className="absolute -top-1 -right-1 w-4 h-4 rounded-full bg-blue-600 text-white text-[9px] font-black flex items-center justify-center">{unreadCount > 9 ? "9+" : unreadCount}</span>}
      </div>
      <div>
      <p className="text-xs font-black uppercase tracking-widest text-(--t1)">Сповіщення</p>
      {!notifLoading && <p className="text-[10px] font-bold text-(--t2) mt-0.5">{unreadCount > 0 ? `${unreadCount} непрочитаних` : "Все прочитано"}</p>}
      </div>
      </div>
      {unreadCount > 0 && (
        <button onClick={markAllRead} className="flex items-center gap-1.5 text-[10px] font-black uppercase tracking-widest text-(--t2) hover:text-blue-600 border border-(--brd) bg-(--bg) rounded-xl px-3 py-1.5 transition-all hover:border-blue-600/40 active:scale-95">
        <CheckCheck size={12} /> Всі
        </button>
      )}
      </div>
      <div className="p-4 sm:p-5 max-h-[calc(100vh-220px)] overflow-y-auto">
      {notifLoading ? (
        <div className="space-y-2.5">{[1,2,3].map(i => <div key={i} className="h-[72px] rounded-xl animate-pulse" style={{background:"var(--brd)"}} />)}</div>
      ) : notifications.length === 0 ? (
        <div className="flex flex-col items-center py-12 text-center">
        <Bell className="w-10 h-10 text-(--t2) mb-3 opacity-25" />
        <p className="text-sm font-black text-(--t1) mb-1">Немає сповіщень</p>
        </div>
      ) : (
        <div className="space-y-2.5">
        {notifications.map((notif, i) => (
          <NotificationCard
          key={notif.id} notif={notif} idx={i}
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

    {showAvatarEditor && profileUser && (
      <AvatarEditorModal userId={profileUser.id} supabase={supabase}
      onSave={(url) => setProfileUser((prev: any) => ({ ...prev, avatar_url: url }))}
      onClose={() => setShowAvatarEditor(false)} />
    )}
    </div>
  );
}
