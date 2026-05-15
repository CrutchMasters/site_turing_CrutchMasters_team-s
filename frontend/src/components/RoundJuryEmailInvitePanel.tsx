"use client";

import React, { useState, useEffect, useCallback } from "react";
import { Mail, Send, Check, X, Loader, Clock, RefreshCw } from "lucide-react";
import { useAuth } from "@/context/AuthContext";

const API_URL =
  typeof window !== "undefined" && window.location.hostname === "localhost"
    ? "http://localhost:8000"
    : "https://site-turing-crutchmasters-team-s.onrender.com";

interface EmailInvitation {
  id: string;
  invited_email: string;
  status: "pending" | "accepted" | "expired";
  created_at: string;
  expires_at: string;
  accepted_at?: string;
}

interface Props {
  roundId: string;
  roundName?: string;
  roundNumber?: number;
}

const statusLabel: Record<EmailInvitation["status"], string> = {
  pending:  "Очікує",
  accepted: "Прийнято",
  expired:  "Прострочено",
};

const statusColors: Record<EmailInvitation["status"], string> = {
  pending:  "text-amber-500 bg-amber-500/10 border-amber-500/20",
  accepted: "text-green-500 bg-green-500/10 border-green-500/20",
  expired:  "text-slate-400 bg-slate-500/10 border-slate-500/20",
};

export default function RoundJuryEmailInvitePanel({ roundId, roundName, roundNumber }: Props) {
  const { token: authToken } = useAuth();
  const [email, setEmail]         = useState("");
  const [sending, setSending]     = useState(false);
  const [loading, setLoading]     = useState(false);
  const [invitations, setInvitations] = useState<EmailInvitation[]>([]);
  const [toast, setToast] = useState<{ message: string; type: "success" | "error" } | null>(null);
  const [confirmSend, setConfirmSend] = useState(false);

  const showToast = (message: string, type: "success" | "error" = "success") => {
    setToast({ message, type });
    setTimeout(() => setToast(null), 4000);
  };

  const authHeader = useCallback((): Record<string, string> => {
    return {
      "Content-Type": "application/json",
      Authorization: `Bearer ${authToken ?? ""}`,
    };
  }, [authToken]);

  const fetchInvitations = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch(`${API_URL}/api/rounds/${roundId}/email-invitations`, {
        headers: authHeader(),
      });
      if (res.ok) {
        const data = await res.json();
        setInvitations(data.invitations ?? []);
      }
    } catch {
      // silent
    } finally {
      setLoading(false);
    }
  }, [roundId, authHeader]);

  useEffect(() => { fetchInvitations(); }, [fetchInvitations]);

  const sendInvite = async () => {
    if (!email.trim()) return;
    setSending(true);
    setConfirmSend(false);
    try {
      const res = await fetch(`${API_URL}/api/rounds/${roundId}/invite-by-email`, {
        method: "POST",
        headers: authHeader(),
        body: JSON.stringify({ email: email.trim(), round_id: roundId }),
      });
      const data = await res.json();
      if (!res.ok) {
        showToast(data.detail ?? "Помилка відправки", "error");
        return;
      }
      showToast(`Запрошення надіслано на ${email.trim()}!`);
      setEmail("");
      await fetchInvitations();
    } catch {
      showToast("Помилка з'єднання", "error");
    } finally {
      setSending(false);
    }
  };

  const roundLabel = roundName || (roundNumber ? `Раунд ${roundNumber}` : "цей раунд");

  return (
    <div className="bg-(--card) rounded-2xl sm:rounded-[2.5rem] border border-blue-500/20 shadow-sm overflow-hidden">

      {/* Header */}
      <div className="w-full flex items-center gap-3 px-6 sm:px-8 py-4 border-b border-blue-500/10">
        <div className="w-8 h-8 rounded-xl bg-blue-500/15 border border-blue-500/30 flex items-center justify-center flex-shrink-0">
          <Mail size={15} className="text-blue-500" />
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-xs font-black uppercase tracking-widest text-blue-500">Email-запрошення журі</p>
          <p className="text-[10px] font-bold text-(--t2) mt-0.5">
            Для тих, хто ще не зареєстрований на платформі
          </p>
        </div>
        <button
          type="button"
          onClick={fetchInvitations}
          disabled={loading}
          className="w-7 h-7 rounded-lg bg-(--bg) border border-(--brd) flex items-center justify-center text-(--t2) hover:text-blue-500 transition-all"
          title="Оновити"
        >
          <RefreshCw size={12} className={loading ? "animate-spin" : ""} />
        </button>
      </div>

      <div className="p-6 sm:p-8 space-y-5">

        {/* Input form */}
        <div>
          <p className="text-[10px] font-black uppercase tracking-widest text-(--t2) mb-2 flex items-center gap-1.5">
            <Send size={10} className="text-blue-500" /> Надіслати запрошення
          </p>
          <div className="flex gap-2">
            <div className="relative flex-1">
              <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-(--t2) pointer-events-none" />
              <input
                type="email"
                placeholder="email@example.com"
                value={email}
                onChange={e => setEmail(e.target.value)}
                onKeyDown={e => e.key === "Enter" && email.trim() && setConfirmSend(true)}
                className="w-full pl-10 pr-4 py-2.5 rounded-xl border border-(--brd) bg-(--bg) text-(--t1) focus:ring-2 focus:ring-blue-500/30 focus:border-blue-500 outline-none text-sm transition-all"
              />
            </div>
            <button
              type="button"
              onClick={() => email.trim() && setConfirmSend(true)}
              disabled={!email.trim() || sending}
              className="flex items-center gap-1.5 px-4 py-2.5 rounded-xl bg-blue-600 text-white font-black text-[11px] uppercase tracking-widest hover:bg-blue-700 transition-all active:scale-95 disabled:opacity-40 disabled:cursor-not-allowed"
            >
              {sending ? <Loader size={12} className="animate-spin" /> : <Send size={12} />}
              {sending ? "..." : "Надіслати"}
            </button>
          </div>
          <p className="mt-1.5 text-[10px] text-(--t2) font-medium">
            Отримувач отримає лист з посиланням на реєстрацію. Роль «журі» та доступ до{" "}
            <span className="font-black">«{roundLabel}»</span> видаються автоматично.
          </p>
        </div>

        {/* Invitations list */}
        {invitations.length > 0 && (
          <div>
            <p className="text-[10px] font-black uppercase tracking-widest text-(--t2) mb-2 flex items-center gap-1.5">
              <Clock size={10} /> Відправлені запрошення ({invitations.length})
            </p>
            <div className="space-y-1.5 max-h-52 overflow-y-auto pr-0.5">
              {invitations.map(inv => (
                <div
                  key={inv.id}
                  className="flex items-center gap-3 px-3 py-2 rounded-xl border border-(--brd) bg-(--bg)"
                >
                  <Mail size={13} className="text-(--t2) flex-shrink-0" />
                  <span className="flex-1 text-xs font-bold text-(--t1) truncate">
                    {inv.invited_email}
                  </span>
                  <span className={`text-[9px] font-black uppercase tracking-wider px-2 py-0.5 rounded-lg border ${statusColors[inv.status]}`}>
                    {statusLabel[inv.status]}
                  </span>
                </div>
              ))}
            </div>
          </div>
        )}

        {invitations.length === 0 && !loading && (
          <div className="text-center py-5">
            <Mail className="w-9 h-9 text-(--t2) opacity-25 mx-auto mb-2" />
            <p className="text-[11px] font-black uppercase tracking-widest text-(--t2)">
              Запрошень ще не надсилалось
            </p>
          </div>
        )}
      </div>

      {/* Toast */}
      {toast && (
        <div className={`fixed bottom-6 left-1/2 -translate-x-1/2 z-[60] flex items-center gap-2.5 px-5 py-3 rounded-2xl shadow-2xl border text-sm font-black animate-in fade-in slide-in-from-bottom-4 duration-300 ${
          toast.type === "success"
            ? "bg-green-500 border-green-400 text-white"
            : "bg-red-500 border-red-400 text-white"
        }`}>
          {toast.type === "success" ? <Check size={15} /> : <X size={15} />}
          {toast.message}
        </div>
      )}

      {/* Confirm modal */}
      {confirmSend && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
          <div className="bg-(--card) rounded-2xl border border-blue-500/30 shadow-2xl w-full max-w-sm p-6 space-y-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-blue-500/15 border border-blue-500/30 flex items-center justify-center flex-shrink-0">
                <Mail size={18} className="text-blue-500" />
              </div>
              <div>
                <p className="text-sm font-black text-(--t1)">Надіслати запрошення?</p>
                <p className="text-[11px] font-bold text-(--t2) mt-0.5">
                  Лист з посиланням для реєстрації
                </p>
              </div>
            </div>
            <div className="px-4 py-3 rounded-xl bg-blue-500/5 border border-blue-500/15">
              <p className="text-xs font-black text-(--t1)">{email.trim()}</p>
              <p className="text-[10px] font-bold text-(--t2) mt-0.5">
                Отримає доступ до: <span className="text-(--t1)">{roundLabel}</span>
              </p>
            </div>
            <div className="flex gap-2 pt-1">
              <button
                type="button"
                onClick={() => setConfirmSend(false)}
                className="flex-1 px-4 py-2.5 rounded-xl border border-(--brd) bg-(--bg) text-(--t1) text-xs font-black uppercase tracking-widest hover:border-blue-500/40 transition-all"
              >
                Скасувати
              </button>
              <button
                type="button"
                onClick={sendInvite}
                className="flex-1 px-4 py-2.5 rounded-xl bg-blue-600 text-white text-xs font-black uppercase tracking-widest hover:bg-blue-700 transition-all active:scale-95"
              >
                Надіслати
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
