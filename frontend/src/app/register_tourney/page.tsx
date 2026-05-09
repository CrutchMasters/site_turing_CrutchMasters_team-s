//src/app/jury/rounds/[id]/evaluate/page.tsx
"use client";

import React, { useState, useEffect, useCallback, useRef } from "react";
import { useRouter, useParams } from "next/navigation";
import { useAuth } from "@/context/AuthContext";
import { useTheme } from "@/hooks/useTheme";
import { supabase } from "@/lib/supabase";
import Sidebar from "@/components/Sidebar";
import MobileHeader from "@/components/MobileHeader";
import {
  Trophy, ChevronRight, ChevronLeft, ArrowLeft, Loader, Save,
  CheckCircle2, AlertCircle, Github, Video,
  RefreshCw, Star, BarChart2, Shuffle, Users,
  Lock, Unlock, ChevronDown, ChevronUp, Eye,
  Clock, Shield, Zap, Award, X, FileText,
} from "lucide-react";

// ── Types ────────────────────────────────────────────────────────────────────

interface CriterionScore {
  key: string;
  label: string;
  weight: number; // 0–100, sum of all = 100
  score: number | ""; // 0–100
  comment: string;
}

interface SubmissionWork {
  id: string;
  team_id: string;
  team_name: string;
  team_org?: string;
  team_avatar_url?: string;
  round_id: string;
  submitted_at: string;
  github_url?: string;
  youtube_url?: string;
  live_url?: string;
  files?: { name: string; path: string; url: string | null }[];
  status: "not_evaluated" | "in_progress" | "evaluated";
  // filled after evaluation load
  criteria: CriterionScore[];
  general_comment: string;
  total_score?: number;
}

interface RoundInfo {
  id: string;
  number: number;
  name: string;
  description?: string;
  tournament_id: string;
  tournament_name?: string;
  end_at?: string;
  status?: string;
}

function DateTimePair({
  label,
  dateVal, onDate,
  timeVal, onTime,
  required,
  requiredLabel,
}: {
  label: string;
  dateVal: string; onDate: (v: string) => void;
  timeVal: string; onTime: (v: string) => void;
  required?: boolean;
  requiredLabel?: string;
}) {
  return (
    <div className="flex flex-col gap-2">
    <div className="flex items-center justify-between">
    <span className="text-[10px] font-black uppercase tracking-widest text-(--t2)">{label}</span>
    {required && (
      <span className="text-[9px] font-black uppercase text-red-500 flex items-center gap-1">
      <Zap className="w-2.5 h-2.5 fill-red-500" /> {requiredLabel ?? "Обов'язково"}
      </span>
    )}
    </div>
    <DatePicker value={dateVal} onChange={onDate} />
    <TimePicker value={timeVal} onChange={onTime} />
    </div>
  );
}

// ── Default criteria (fallback if round has no criteria column) ───────────────

const DEFAULT_CRITERIA: Omit<CriterionScore, "score" | "comment">[] = [
  { key: "backend_quality",    label: "Backend якість коду",       weight: 20 },
{ key: "database_structure", label: "Database структура",        weight: 20 },
{ key: "frontend_quality",   label: "Frontend якість/UX",        weight: 20 },
{ key: "must_have",          label: 'Виконання "must have"',      weight: 20 },
{ key: "no_bugs",            label: "Робото­здатність, без багів", weight: 20 },
];

function buildCriteriaFromRound(roundCriteria: Omit<CriterionScore, "score" | "comment">[] | null): CriterionScore[] {
  const source = (roundCriteria && roundCriteria.length > 0) ? roundCriteria : DEFAULT_CRITERIA;
  return source.map(c => ({ ...c, score: "", comment: "" }));
}

function computeTotal(criteria: CriterionScore[]): number {
  let total = 0;
  for (const c of criteria) {
    if (c.score === "" || isNaN(Number(c.score))) continue;
    total += (Number(c.score) * c.weight) / 100;
  }
  return Math.round(total * 10) / 10;
}

function fmtDate(iso?: string) {
  if (!iso) return "—";
  return new Date(iso).toLocaleString("uk-UA", {
    day: "numeric", month: "short", year: "numeric",
    hour: "2-digit", minute: "2-digit" });
}

// ── Readme Modal ──────────────────────────────────────────────────────────────

function ReadmeModal({ url, text, title, onClose }: { url?: string; text?: string; title?: string; onClose: () => void }) {
  const [content, setContent] = useState<string | null>(text ?? null);
  const [loading, setLoading] = useState(!text && !!url);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (text) { setContent(text); setLoading(false); return; }
    if (!url) return;
    setLoading(true);
    setError(null);
    fetch(url)
    .then(r => {
      if (!r.ok) throw new Error(`HTTP ${r.status}`);
      return r.text();
    })
    .then(t => { setContent(t); setLoading(false); })
    .catch(e => { setError(e.message); setLoading(false); });
  }, [url, text]);

  // Simple markdown → HTML renderer (no external dep)
  const renderMarkdown = (md: string): string => {
    return md
    // Escape HTML
    .replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;")
    // Code blocks
    .replace(/```[\w]*\n?([\s\S]*?)```/g, '<pre class="md-pre"><code>$1</code></pre>')
    // Inline code
    .replace(/`([^`]+)`/g, '<code class="md-code">$1</code>')
    // Headings
    .replace(/^### (.+)$/gm, '<h3 class="md-h3">$1</h3>')
    .replace(/^## (.+)$/gm, '<h2 class="md-h2">$1</h2>')
    .replace(/^# (.+)$/gm, '<h1 class="md-h1">$1</h1>')
    // Bold + italic
    .replace(/\*\*\*(.+?)\*\*\*/g, '<strong><em>$1</em></strong>')
    .replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
    .replace(/\*(.+?)\*/g, '<em>$1</em>')
    // Links
    .replace(/\[([^\]]+)\]\(([^)]+)\)/g, '<a href="$2" target="_blank" rel="noopener noreferrer" class="md-link">$1</a>')
    // Images
    .replace(/!\[([^\]]*)\]\(([^)]+)\)/g, '<img src="$2" alt="$1" class="md-img" />')
    // Horizontal rule
    .replace(/^---$/gm, '<hr class="md-hr" />')
    // Unordered lists
    .replace(/^\s*[-*+] (.+)$/gm, '<li class="md-li">$1</li>')
    .replace(/(<li[\s\S]*?<\/li>)(\s*(?!<li))/g, '<ul class="md-ul">$1</ul>$2')
    // Ordered lists
    .replace(/^\d+\. (.+)$/gm, '<li class="md-oli">$1</li>')
    .replace(/(<li class="md-oli"[\s\S]*?<\/li>)(\s*(?!<li))/g, '<ol class="md-ol">$1</ol>$2')
    // Blockquotes
    .replace(/^> (.+)$/gm, '<blockquote class="md-blockquote">$1</blockquote>')
    // Paragraphs (lines not already wrapped)
    .replace(/^(?!<[hupoba]|<li|<pre|<blockquote|<hr)(.+)$/gm, '<p class="md-p">$1</p>')
    // Clean up empty lines
    .replace(/\n{2,}/g, '\n');
  };

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [onClose]);

  return (
    <div
    className="fixed inset-0 z-[100] flex items-center justify-center p-4"
    style={{ background: "rgba(0,0,0,0.6)", backdropFilter: "blur(6px)" }}
    onClick={e => { if (e.target === e.currentTarget) onClose(); }}
    >
    <div
    className="relative w-full max-w-3xl max-h-[85vh] flex flex-col rounded-[2rem] border border-(--brd) shadow-2xl overflow-hidden"
    style={{ background: "var(--card)" }}
    >
    {/* Header */}
    <div className="flex items-center gap-3 px-6 py-4 border-b border-(--brd)" style={{ background: "var(--bg)" }}>
    <FileText size={16} className="text-blue-600 flex-shrink-0" />
    <span className="text-[11px] font-black uppercase tracking-widest text-(--t1) flex-1">{title ?? "README"}</span>
    <button
    onClick={onClose}
    className="w-8 h-8 rounded-xl flex items-center justify-center border border-(--brd) text-(--t2) hover:text-(--t1) hover:border-blue-600/40 transition-all active:scale-95"
    >
    <X size={14} />
    </button>
    </div>
    {/* Content */}
    <div className="flex-1 overflow-y-auto px-8 py-6">
    {loading && (
      <div className="flex items-center justify-center py-16">
      <div className="w-8 h-8 border-2 border-blue-600 border-t-transparent rounded-full animate-spin" />
      </div>
    )}
    {error && (
      <div className="flex flex-col items-center gap-3 py-16 text-center">
      <AlertCircle size={28} className="text-red-400" />
      <p className="text-sm font-bold text-(--t2)">Не вдалося завантажити файл</p>
      <p className="text-xs text-(--t2) opacity-60">{error}</p>
      <a href={url} target="_blank" rel="noopener noreferrer" className="text-xs font-black text-blue-600 hover:underline mt-1">Відкрити напряму ↗</a>
      </div>
    )}
    {!loading && !error && content !== null && (
      <div
      className="md-body"
      dangerouslySetInnerHTML={{ __html: /^\s*<[a-zA-Z]/.test(content) ? content : renderMarkdown(content) }}
      />
    )}
    </div>
    </div>
    <style>{`
      .md-body { color: var(--t1); font-size: 14px; line-height: 1.7; }
      .md-h1 { font-size: 1.6em; font-weight: 900; margin: 1.2em 0 0.5em; color: var(--t1); }
      .md-h2 { font-size: 1.3em; font-weight: 900; margin: 1em 0 0.4em; color: var(--t1); border-bottom: 1px solid var(--brd); padding-bottom: 0.3em; }
      .md-h3 { font-size: 1.1em; font-weight: 800; margin: 0.8em 0 0.3em; color: var(--t1); }
      .md-p { margin: 0.5em 0; color: var(--t2); }
      .md-pre { background: var(--bg); border: 1px solid var(--brd); border-radius: 12px; padding: 14px 16px; overflow-x: auto; margin: 0.8em 0; font-size: 12px; line-height: 1.5; }
      .md-pre code { background: none; padding: 0; border: none; font-family: monospace; }
      .md-code { background: var(--bg); border: 1px solid var(--brd); border-radius: 6px; padding: 1px 6px; font-size: 12px; font-family: monospace; color: #3b82f6; }
      .md-link { color: #3b82f6; text-decoration: underline; text-underline-offset: 2px; }
      .md-img { max-width: 100%; border-radius: 10px; margin: 0.5em 0; }
      .md-hr { border: none; border-top: 1px solid var(--brd); margin: 1.2em 0; }
      .md-ul, .md-ol { padding-left: 1.5em; margin: 0.4em 0; }
      .md-li, .md-oli { margin: 0.2em 0; color: var(--t2); }
      .md-blockquote { border-left: 3px solid #3b82f6; padding-left: 1em; margin: 0.6em 0; color: var(--t2); opacity: 0.8; font-style: italic; }
      `}</style>
      </div>
  );
}

// ── Score slider / input ─────────────────────────────────────────────────────

function ScoreInput({
  value, onChange, disabled,
}: {
  value: number | ""; onChange: (v: number | "") => void; disabled?: boolean;
}) {
  const [focused, setFocused] = useState(false);
  const num = value === "" ? 0 : Number(value);

  const color =
  value === "" ? "var(--brd)"
  : num >= 80 ? "#22c55e"
  : num >= 50 ? "#3b82f6"
  : num >= 30 ? "#f59e0b"
  : "#ef4444";

  return (
    <div className="flex items-center gap-3">
    {/* Track wrapper */}
    <div className="relative flex-1 flex items-center" style={{ height: 24 }}>
    {/* Background track */}
    <div className="absolute inset-x-0 h-2 rounded-full" style={{ top: "50%", transform: "translateY(-50%)", background: "var(--brd)" }} />
    {/* Fill track — smooth color + width transition */}
    <div
    className="absolute left-0 h-2 rounded-full pointer-events-none"
    style={{ top: "50%", transform: "translateY(-50%)", width: `${num}%`, background: color, transition: "background 0.35s ease, width 0.05s linear" }}
    />
    <input
    type="range"
    min={0} max={100} step={1}
    value={num}
    onChange={e => onChange(Number(e.target.value))}
    disabled={disabled}
    className="absolute inset-0 w-full cursor-pointer disabled:cursor-not-allowed"
    style={{ height: "100%", opacity: 1, background: "transparent", WebkitAppearance: "none", appearance: "none" }}
    />
    </div>
    {/* Number input */}
    <div
    className="relative flex-shrink-0"
    style={{ width: 56 }}
    >
    <input
    type="number"
    min={0} max={100}
    value={value}
    onChange={e => {
      const v = e.target.value;
      if (v === "") { onChange(""); return; }
      const n = Math.min(100, Math.max(0, Number(v)));
      onChange(n);
    }}
    onFocus={() => setFocused(true)}
    onBlur={() => setFocused(false)}
    disabled={disabled}
    placeholder="—"
    className={`w-full text-center py-1.5 rounded-xl border text-sm font-black outline-none transition-all
      [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none
      disabled:opacity-40 disabled:cursor-not-allowed`}
      style={{
        background: "var(--bg)",
          borderColor: focused ? color : "var(--brd)",
          color: value !== "" ? color : "var(--t2)",
          boxShadow: focused ? `0 0 0 2px ${color}30` : "none",
          fontVariantNumeric: "tabular-nums",
      }}
      />
      </div>
      </div>
  );
}

// ── Submission card ───────────────────────────────────────────────────────────

function SubmissionCard({
  work,
  isActive,
  onSelect,
  juryId,
}: {
  work: SubmissionWork;
  isActive: boolean;
  onSelect: () => void;
  juryId: string;
}) {
  const total = work.total_score ?? (work.criteria.some(c => c.score !== "") ? computeTotal(work.criteria) : undefined);

  const statusIcon =
  work.status === "evaluated"   ? <CheckCircle2 size={14} className="text-green-500" /> :
  work.status === "in_progress" ? <Clock        size={14} className="text-amber-500" /> :
  <AlertCircle size={14} className="text-(--t2) opacity-40" />;

  const statusLabel =
  work.status === "evaluated"   ? "Оцінено" :
  work.status === "in_progress" ? "В процесі" :
  "Не оцінено";

    return (
      <button
      onClick={onSelect}
      className={`w-full text-left p-4 rounded-2xl border transition-all group ${
        isActive
        ? "border-blue-600 bg-blue-600/8 shadow-md shadow-blue-600/10"
        : "border-(--brd) bg-(--card) hover:border-blue-600/40 hover:bg-(--bg)"
      }`}
      >
      <div className="flex items-start gap-2 mb-2">
      <div className="w-8 h-8 rounded-xl overflow-hidden flex-shrink-0 mt-0.5">
      {work.team_avatar_url
        ? <img src={work.team_avatar_url} alt={work.team_name} className="w-full h-full object-cover" />
        : <div className="w-full h-full bg-blue-600/10 text-blue-600 flex items-center justify-center text-xs font-black">{work.team_name.charAt(0).toUpperCase()}</div>
      }
      </div>
      <div className="flex-1 min-w-0">
      <p className={`font-black text-sm truncate ${isActive ? "text-blue-600" : "text-(--t1) group-hover:text-blue-600 transition-colors"}`}>
      {work.team_name}
      </p>
      {work.team_org && (
        <p className="text-[10px] font-bold text-(--t2) truncate mt-0.5">{work.team_org}</p>
      )}
      </div>
      <div className="flex items-center gap-1.5 flex-shrink-0">
      {statusIcon}
      <span className={`text-[10px] font-black rounded-lg border ${
        total === undefined ? "text-transparent border-transparent bg-transparent" :
        total >= 80 ? "text-green-500 bg-green-500/10 border-green-500/20" :
        total >= 50 ? "text-blue-500 bg-blue-500/10 border-blue-500/20" :
        "text-amber-500 bg-amber-500/10 border-amber-500/20"
      }`} style={{ width: 40, textAlign: "center", padding: "2px 0", fontVariantNumeric: "tabular-nums", display: "inline-block" }}>
      {total !== undefined ? total : ""}
      </span>
      </div>
      </div>
      <div className="flex items-center gap-2 flex-wrap">
      <span className={`text-[9px] font-black uppercase tracking-widest ${
        work.status === "evaluated"   ? "text-green-500" :
        work.status === "in_progress" ? "text-amber-500" :
        "text-(--t2) opacity-60"
      }`}>
      {statusLabel}
      </span>
      <span className="text-[9px] text-(--t2) opacity-40">·</span>
      <span className="text-[9px] font-bold text-(--t2) opacity-60">
      {fmtDate(work.submitted_at)}
      </span>
      </div>
      </button>
    );
}

// ── Main page ─────────────────────────────────────────────────────────────────

export default function JuryEvaluationPage() {
  const [isMobileSidebarOpen, setIsMobileSidebarOpen] = useState(false);
  const params = useParams();
  const router = useRouter();
  const { user, isLoading: authLoading } = useAuth();
  const { dark } = useTheme();
  const roundId = params?.id as string;

  // -- Data --
  const [round, setRound] = useState<RoundInfo | null>(null);
  const [roundCriteria, setRoundCriteria] = useState<Omit<CriterionScore, "score" | "comment">[] | null>(null);
  const [works, setWorks] = useState<SubmissionWork[]>([]);
  const [stats, setStats] = useState<DistributionStats>({ total: 0, distributed: 0, evaluated: 0 });
  const [pageLoading, setPageLoading] = useState(true);

  // -- UI --
  const [activeIdx, setActiveIdx] = useState<number | null>(null);
  const [saving, setSaving] = useState(false);
  const [saveMsg, setSaveMsg] = useState<{ type: "ok" | "err"; text: string } | null>(null);
  const [redistributing, setRedistributing] = useState(false);
  const [showAllInfo, setShowAllInfo] = useState(false);
  const [readmeModal, setReadmeModal] = useState<{ url?: string; text?: string; title?: string } | null>(null);
  const [mobileTab, setMobileTab] = useState<"list" | "form">("list");
  const saveMsgTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const isJury     = user?.role === "jury";
  const isAdmin    = user?.role === "admin" || user?.role === "superadmin";
  const canAccess  = isJury || isAdmin;

  const API_URL = typeof window !== "undefined" && window.location.hostname === "localhost"
  ? "http://localhost:8000"
  : "https://site-turing-crutchmasters-team-s.onrender.com";

  // ── Access guard ──────────────────────────────────────────────────────────
  useEffect(() => {
    if (!authLoading && !user) { router.push("/login"); return; }
    if (!authLoading && user && !canAccess) { router.push("/dashboard"); }
  }, [authLoading, user, canAccess, router]);

  // ── Fetch round + submissions ─────────────────────────────────────────────
  const fetchData = useCallback(async () => {
    if (!roundId || !user) return;
    setPageLoading(true);

  useEffect(() => {
    if (accessState !== 'checking') return;
    timerRef.current = setInterval(() => {
      setCountdown(prev => {
        if (prev <= 1) { clearInterval(timerRef.current!); setAccessState('denied'); return 0; }
        return prev - 1;
      });
    }, 1000);
    return () => { if (timerRef.current) clearInterval(timerRef.current); };
  }, [accessState]);

  const handleConfirmYes = () => { if (timerRef.current) clearInterval(timerRef.current); setAccessState('denied'); };
  const handleConfirmNo  = () => { if (timerRef.current) clearInterval(timerRef.current); router.push('/login'); };

  // localToIso: локальний час браузера → ISO UTC для збереження в БД (нульовий пояс).
  const toTimestamp = localToIso;;

  const API_URL =
  typeof window !== 'undefined' && window.location.hostname === 'localhost'
  ? 'http://localhost:8000'
  : 'https://site-turing-crutchmasters-team-s.onrender.com';

  // БАГ 6 fix: завантажуємо файли раундів через бекенд (service_role),
  // а не напряму через anon key — інакше приватний bucket поверне 403.
  // Повертає signed URL (10 років), який зберігаємо в attachments.
  const uploadFile = async (file: File, roundNumber: number): Promise<string> => {
    const token = await getToken();
    if (!token) throw new Error('Не вдалося отримати токен авторизації. Спробуйте увійти знову. [upload]');

    const form = new FormData();
    form.append('round_number', String(roundNumber));
    form.append('file', file);

    const res = await fetch(`${API_URL}/api/upload/round-file`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}` },
      body: form,
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(`Помилка завантаження файлу "${file.name}": ${err.detail ?? res.statusText}`);
    }
    const data = await res.json();
    // Бекенд повертає signed_url (довготривалий, service_role)
    return data.signed_url as string;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitError(null);
    if (!tourneyName.trim()) { setSubmitError(t.tourney?.errNameRequired ?? "Назва турніру є обов'язковою"); return; }
    if (!startDate)          { setSubmitError(t.tourney?.errStartRequired ?? "Дата старту турніру є обов'язковою"); return; }
    setIsSubmitting(true);
    try {
      // Перевірка дублікату назви
      const { data: existing, error: checkError } = await supabase
      .from("tournaments")
      .select("id")
      .ilike("name", tourneyName.trim())
      .limit(1);
      if (!checkError && existing && existing.length > 0) {
        setSubmitError((t.tourney?.errDuplicate ?? 'Турнір з назвою "{name}" вже існує. Оберіть іншу назву.').replace('{name}', tourneyName.trim()));
        setIsSubmitting(false);
        return;
      }

      // Формуємо масив раундів — файли спочатку завантажуємо в Storage
      const roundsPayload = await Promise.all(
        Array.from({ length: roundCount }, async (_, i) => {
          const n = i + 1;
          const rd = roundsData[n];

          // 1. Посилання (URL-рядки) → тип "link"
          const linkAttachments = (rd?.links ?? [])
          .filter(Boolean)
          .map((url, idx) => ({
            id: `link-${n}-${idx}`,
            name: url,
            url,
            type: 'link' as const,
          }));

          // 2. Файли → завантажуємо в Storage → тип "file"
          const fileAttachments: { id: string; name: string; url: string; type: 'file' }[] = [];
          // Guard: розпаковуємо FileItem { file: File, name, size, type } або голий File
          const rawFiles: File[] = ((rd as any)?.files ?? [])
          .map((f: unknown): File | null => {
            if (f instanceof File) return f;
            if (f && typeof f === 'object' && (f as any).file instanceof File)
              return (f as any).file as File;
            return null;
          })
          .filter((f: File | null): f is File => f !== null);
          for (let fi = 0; fi < rawFiles.length; fi++) {
            const file = rawFiles[fi];
            const publicUrl = await uploadFile(file, n);
            fileAttachments.push({
              id: `file-${n}-${fi}`,
              name: file.name,
              url: publicUrl,
              type: 'file' as const,
            });
          }

          const attachments = [...linkAttachments, ...fileAttachments];

          return {
            number:       n,
            name:         rd?.name?.trim()                        || `Раунд ${n}`,
                   description:  rd?.description?.trim()                 || null,
                   criteria:     rd?.criteria?.filter(Boolean).join('\n')|| null,
                   technologies: rd?.requirements?.filter(Boolean)       ?? [],
                   start_at:     toTimestamp(rd?.startDate ?? '', rd?.startTime ?? '') ?? null,
                   end_at:       toTimestamp(rd?.deadlineDate ?? '', rd?.deadlineTime ?? '') ?? null,
                   // links — зберігаємо для зворотної сумісності
                   links:        linkAttachments,
                   // attachments — єдине поле що читає сторінка раунду
                   attachments,
                   status: 'pending',
          };
        })
      );

      // Явно передаємо p_rounds_data: null — Postgres вибере 8-параметрову версію
      // (без цього — "ambiguous overload" між 7- та 8-параметровою функцією)
      // Раунди вставляємо окремо нижче через supabase.from("rounds").insert(...)
      // FIX: передаємо p_end_at (кінець турніру) і p_created_by (fallback якщо auth.uid() null)
      const { data: tournamentId, error: rpcError } = await supabase.rpc("create_tournament", {
        p_name:              tourneyName.trim(),
                                                                         p_rules:             description.trim() || null,
                                                                         p_start_at:          toTimestamp(startDate, startTime),
                                                                         p_end_at:            toTimestamp(endDate, endTime) || null,
                                                                         p_registration_from: toTimestamp(regStartDate, regStartTime),
                                                                         p_registration_to:   toTimestamp(regEndDate, regEndTime),
                                                                         p_max_teams:         teamCount > 0 ? teamCount : null,
                                                                         p_rounds:            roundCount,
                                                                         p_rounds_data:       null,
                                                                         p_created_by:        user?.id ?? null,
      });
      if (rpcError) throw new Error(rpcError.message || rpcError.details || JSON.stringify(rpcError));
      if (!tournamentId) throw new Error(t.tourney?.errNoId ?? 'Турнір створено, але ID не повернуто');

      // Вставляємо раунди через бекенд (service_role) — anon key не має прав на INSERT в rounds (RLS 401)
      // БАГ 8 fix: перевіряємо ліміт constraint (1-8) перед відправкою
      if (roundsPayload.length > 8) {
        throw new Error(t.tourney?.errMaxRounds ?? 'Максимальна кількість раундів — 8');
      }
      const token = await getToken();
      if (!token) throw new Error(t.tourney?.errNoToken ?? 'Не вдалося отримати токен авторизації. Спробуйте увійти знову.');
      const roundsRes = await fetch(`${API_URL}/api/tournaments/${tournamentId}/rounds`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`,
        },
        body: JSON.stringify({ rounds: roundsPayload }),
      });
      if (!roundsRes.ok) {
        const err = await roundsRes.json().catch(() => ({}));
        const errMsg: string = err.detail ?? JSON.stringify(err);
        if (errMsg.includes('rounds_number_check') || errMsg.includes('number_check')) {
          throw new Error(t.tourney?.errRoundNumber ?? 'Номер раунду має бути від 1 до 8. Перевірте кількість раундів.');
        }
        throw new Error((t.tourney?.errRoundsSave ?? 'Турнір створено, але раунди не збережено: {detail}').replace('{detail}', errMsg));
      }
      const subsJson = await subsRes.json();
      const assignedSubmissions: any[] = subsJson.submissions ?? [];

      router.push('/dashboard');
    } catch (err: any) {
      console.error('Помилка створення турніру:', err?.message ?? err);
      // БАГ 8 fix: зрозуміле повідомлення про constraint раундів
      const msg: string = err?.message ?? '';
      if (msg.includes('rounds_number_check') || msg.includes('number_check')) {
        setSubmitError(t.tourney?.errRoundNumber ?? 'Номер раунду має бути від 1 до 8. Перевірте кількість раундів.');
      } else if (msg.includes('Максимальна кількість раундів') || msg.includes('Maximum number of rounds') || msg.includes('Максимальное количество')) {
        setSubmitError(msg);
      } else {
        setSubmitError(msg || (t.tourney?.errGeneric ?? 'Виникла помилка. Спробуйте ще раз.'));
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  /* ── Loading ── */
  if (accessState === 'loading' || isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-(--bg)">
      <div className="w-8 h-8 border-2 border-blue-600 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  /* ── Checking ── */
  if (accessState === 'checking') {
    const progress = ((COUNTDOWN_SEC - countdown) / COUNTDOWN_SEC) * 100;
    const circumference = 2 * Math.PI * 28;
    return (
      <div className="min-h-screen flex items-center justify-center relative overflow-hidden bg-(--bg) text-(--t1)">
      <style>{`
        @keyframes fadeInModal { from{opacity:0;transform:scale(0.95) translateY(16px)} to{opacity:1;transform:scale(1) translateY(0)} }
        @keyframes pulse-ring  { 0%{box-shadow:0 0 0 0 rgba(239,68,68,0.35)} 70%{box-shadow:0 0 0 14px rgba(239,68,68,0)} 100%{box-shadow:0 0 0 0 rgba(239,68,68,0)} }
        .modal-card{animation:fadeInModal 0.4s cubic-bezier(.22,1,.36,1) both}
        .pulse-btn{animation:pulse-ring 1.4s ease-out infinite}
        `}</style>
        <div className="absolute inset-0 pointer-events-none">
        <div className="absolute -top-40 -left-40 w-[600px] h-[600px] rounded-full opacity-[0.07] blur-3xl bg-red-500" />
        <div className="absolute -bottom-40 -right-40 w-[500px] h-[500px] rounded-full opacity-[0.07] blur-3xl bg-orange-500" />
        </div>
        <div className="modal-card relative z-10 w-full max-w-md mx-4 bg-(--card) rounded-2xl sm:rounded-[2.5rem] shadow-2xl border border-red-500/30 p-8">
        <div className="flex flex-col items-center mb-6">
        <div className="relative w-20 h-20 mb-4">
        <svg className="w-20 h-20 -rotate-90" viewBox="0 0 64 64">
        <circle cx="32" cy="32" r="28" fill="none" stroke="rgba(239,68,68,0.15)" strokeWidth="4" />
        <circle cx="32" cy="32" r="28" fill="none" stroke="#ef4444" strokeWidth="4"
        strokeLinecap="round" strokeDasharray={circumference}
        strokeDashoffset={circumference * (progress / 100)}
        style={{ transition: 'stroke-dashoffset 0.9s linear' }} />
        </svg>
        <div className="absolute inset-0 flex items-center justify-center">
        <span className="text-2xl font-black tabular-nums text-red-500">{countdown}</span>
        </div>
        </div>
        <h2 className="text-xl font-black uppercase tracking-tight text-center mb-1 text-(--t1)">{t.tourney?.accessDeniedTitle ?? '⚠️ Обмежений доступ'}</h2>
        <p className="text-sm text-center text-(--t2)">{t.tourney?.accessDeniedDesc ?? 'У вас немає прав для перегляду цієї сторінки'}</p>
        </div>
        <div className="h-px mb-6 bg-(--brd)" />
        <p className="text-base font-black uppercase tracking-tight text-center mb-2 text-(--t1)">{t.tourney?.accessDeniedQuestion ?? 'Точно хочете переглянути цю сторінку?'}</p>
        <p className="text-xs text-center mb-6 text-(--t2)">
        {(t.tourney?.accessDeniedCountdown ?? 'Через {sec} сек ви автоматично побачите, що чекає на порушників 🐇').replace('{sec}', String(countdown))}
        </p>
        <div className="flex gap-3">
        <button onClick={handleConfirmYes} className="pulse-btn flex-1 py-3 rounded-2xl font-black text-xs uppercase tracking-widest text-white bg-red-500 active:scale-95 transition-all">{t.tourney?.accessDeniedYes ?? 'Так, показати'}</button>
        <button onClick={handleConfirmNo}  className="flex-1 py-3 rounded-2xl font-black text-xs uppercase tracking-widest border border-(--brd) text-(--t2) bg-(--bg) active:scale-95 transition-all hover:opacity-80">{t.tourney?.accessDeniedNo ?? 'Ні, піти'}</button>
        </div>
        <p className="text-center text-[10px] mt-4 text-(--t2) opacity-50">{t.tourney?.accessDeniedNoHint ?? '«Ні» → повернути на сторінку входу'}</p>
        </div>
        </div>
    );
  }

      // 3. Build work list — бекенд вже повертає my_evaluation для журі,
      //    тому окремого запиту до jury_evaluations не потрібно.
      const workList: SubmissionWork[] = assignedSubmissions.map((s: any) => {
        // my_evaluation присутній якщо роль === "jury", інакше null
        const existingEval = s.my_evaluation ?? null;
        let criteria = buildCriteriaFromRound(parsedCriteria);
        let general_comment = "";
        let total_score: number | undefined;
        let status: SubmissionWork["status"] = "not_evaluated";

        if (existingEval) {
          const saved: Record<string, { score: number; comment: string }> = existingEval.criteria_scores ?? {};
          criteria = criteria.map(c => ({
            ...c,
            score: saved[c.key]?.score ?? "",
            comment: saved[c.key]?.comment ?? "",
          }));
          general_comment = existingEval.general_comment ?? "";
          total_score = existingEval.total_score;
          const allFilled = criteria.every(c => c.score !== "");
          status = allFilled ? "evaluated" : "in_progress";
        }
        @keyframes fadeSlideUp { from{opacity:0;transform:translateY(30px)} to{opacity:1;transform:translateY(0)} }
        @keyframes rabbit-fall { 0%{top:-80px;opacity:0;transform:translateX(-50%) rotate(0deg)} 30%{opacity:1} 100%{top:110%;opacity:0;transform:translateX(-50%) rotate(720deg)} }
        @keyframes scanline { 0%{transform:translateY(-100%)} 100%{transform:translateY(100vh)} }
        .glitch-text{position:relative}
        .glitch-text::before,.glitch-text::after{content:attr(data-text);position:absolute;inset:0;font:inherit;text-align:inherit}
        .glitch-text::before{color:#3b82f6;animation:glitch 2.5s infinite steps(1);animation-delay:0.1s}
        .glitch-text::after{color:#8b5cf6;animation:glitch 2.5s infinite steps(1);animation-delay:0.35s}
        .fade-up{animation:fadeSlideUp 0.6s cubic-bezier(.22,1,.36,1) both}
        .fade-up-1{animation:fadeSlideUp 0.6s cubic-bezier(.22,1,.36,1) 0.15s both}
        .fade-up-2{animation:fadeSlideUp 0.6s cubic-bezier(.22,1,.36,1) 0.3s both}
        .rabbit{position:fixed;left:50%;font-size:3rem;animation:rabbit-fall 3s ease-in 0.5s both;z-index:50}
        .scanline{position:fixed;inset:0;pointer-events:none;z-index:40;background:linear-gradient(transparent 50%,rgba(0,0,0,0.03) 50%);background-size:100% 4px}
        .scanline::after{content:'';position:absolute;left:0;right:0;height:60px;background:linear-gradient(transparent,rgba(59,130,246,0.04),transparent);animation:scanline 3s linear infinite}
        `}</style>
        <div className="scanline" />
        <div className="rabbit">🐇</div>
        <div className="absolute inset-0 pointer-events-none">
        <div className="absolute -top-40 -left-40 w-[700px] h-[700px] rounded-full opacity-[0.06] blur-3xl bg-blue-600" />
        <div className="absolute -bottom-40 -right-40 w-[600px] h-[600px] rounded-full opacity-[0.06] blur-3xl bg-purple-600" />
        </div>
        <div className="relative z-10 flex flex-col items-center text-center px-4">
        <div className="glitch-text text-[120px] sm:text-[160px] font-black leading-none mb-4 select-none fade-up text-(--t1)" data-text="403" style={{ letterSpacing: '-0.05em' }}>403</div>
        <p className="fade-up-1 text-lg sm:text-2xl font-black uppercase tracking-tight mb-2 text-(--t1)">{t.tourney?.deniedTitle ?? 'Ах ти хитрий шукач потаємних шляхів,'}</p>
        <p className="fade-up-1 text-lg sm:text-2xl font-black uppercase tracking-tight mb-8 text-blue-600">{t.tourney?.deniedSubtitle ?? 'привіт від Білого Кролика 🐇'}</p>
        <p className="fade-up-2 text-xs font-black uppercase tracking-[0.3em] mb-10 text-(--t2)">{t.tourney?.deniedDesc ?? 'Ця сторінка тільки для адміністраторів'}</p>
        <div className="fade-up-2 flex flex-col sm:flex-row gap-3 justify-center">
        <a href={'/dashboard'} onClick={(e) => { e.preventDefault(); router.push('/dashboard'); }} className="px-8 py-3.5 rounded-2xl font-black text-xs uppercase tracking-widest bg-blue-600 text-white hover:bg-blue-700 active:scale-95 transition-all shadow-lg shadow-blue-600/20">{t.tourney?.deniedBackDashboard ?? '← Повернутись на дашборд'}</a>
        <a href={'/'} onClick={(e) => { e.preventDefault(); router.push('/'); }} className="px-8 py-3.5 rounded-2xl font-black text-xs uppercase tracking-widest border border-(--brd) text-(--t2) bg-(--bg) active:scale-95 transition-all hover:opacity-80">{t.tourney?.deniedBackHome ?? 'На головну'}</a>
        </div>
        </div>
        </div>
    );
  }

        return {
          id: s.id,
          team_id: s.team_id,
          team_name: s.team_name ?? "Команда",
          team_org: s.team_org,
          team_avatar_url: s.team_avatar_url ?? undefined,
          team_leader: s.team_leader ?? undefined,
          round_id: s.round_id,
          submitted_at: s.submitted_at,
          github_url: s.github_url,
          youtube_url: s.youtube_url,
          live_url: s.live_url ?? undefined,
          files: s.files ?? [],
          status,
          criteria,
          general_comment,
          total_score,
        };
      });

      // Fetch team avatars + captain from Supabase
      const teamIds = [...new Set(workList.map(w => w.team_id).filter(Boolean))];
      if (teamIds.length > 0) {
        const { data: teamsData } = await supabase
        .from("teams")
        .select("id, avatar_url, captain_id")
        .in("id", teamIds);
        if (teamsData) {
          const avatarMap: Record<string, string> = {};
          const captainIdMap: Record<string, string> = {};
          teamsData.forEach((t: any) => {
            if (t.avatar_url) avatarMap[t.id] = t.avatar_url;
            if (t.captain_id) captainIdMap[t.id] = t.captain_id;
          });
            workList.forEach(w => {
              if (avatarMap[w.team_id]) w.team_avatar_url = avatarMap[w.team_id];
            });

              // Fetch captain names from account table
              const captainIds = [...new Set(Object.values(captainIdMap).filter(Boolean))];
              if (captainIds.length > 0) {
                const { data: accountsData } = await supabase
                .from("account")
                .select("id, username, login")
                .in("id", captainIds);
                if (accountsData) {
                  const nameMap: Record<string, string> = {};
                  accountsData.forEach((a: any) => { nameMap[a.id] = a.username || a.login || "—"; });
                  workList.forEach(w => {
                    const capId = captainIdMap[w.team_id];
                    if (capId && nameMap[capId]) (w as any).team_leader = nameMap[capId];
                  });
                }
              }
        }
      }

      setWorks(workList);
      setStats({
        total: totalCount ?? assignedSubmissions.length,
        distributed: assignedSubmissions.length,
        evaluated: workList.filter(w => w.status === "evaluated").length,
      });

      if (workList.length > 0 && activeIdx === null) setActiveIdx(0);
    } catch (e) {
      console.error(e);
    } finally {
      setPageLoading(false);
    }
    // FIX (середній): activeIdx прибрано з deps — перезавантаження даних при
    // зміні активної картки спричиняло зайві fetch-запити і скидало стан форми.
  }, [roundId, user, isJury]);

      {/* Breadcrumb */}
      <nav className="flex items-center gap-2 text-[10px] font-black mb-6 uppercase tracking-widest text-(--t2)">
      <a href={'/'} onClick={(e) => { e.preventDefault(); router.push('/'); }} className="hover:text-blue-600 transition-colors">{t.tourney?.home ?? 'Головна'}</a>
      <ChevronRight size={10} />
      <a href={'/dashboard'} onClick={(e) => { e.preventDefault(); router.push('/dashboard'); }} className="hover:text-blue-600 transition-colors">{t.tourney?.dashboard ?? 'Дашборд'}</a>
      <ChevronRight size={10} />
      <span className="text-(--t1)">{t.tourney?.createAdmin ?? 'Створення турніру'}</span>
      </nav>

      <button onClick={() => router.back()} className="mb-6 flex items-center gap-2 text-[11px] font-black uppercase tracking-widest text-(--t2) hover:text-blue-600 transition-colors">
      <ArrowLeft size={14} /> {t.tourney?.back ?? 'Назад'}
      </button>

    const updateGeneralComment = (comment: string) => {
      if (activeIdx === null) return;
      setWorks(prev => prev.map((w, i) =>
      i === activeIdx ? { ...w, general_comment: comment } : w
      ));
    };

    // ── Save evaluation ───────────────────────────────────────────────────────
    const handleSave = async () => {
      if (activeIdx === null || !user) return;
      const work = works[activeIdx];
      setSaving(true);
      setSaveMsg(null);
      try {
        const criteriaScores: Record<string, { score: number | ""; comment: string }> = {};
        work.criteria.forEach(c => { criteriaScores[c.key] = { score: c.score, comment: c.comment }; });
        const total = computeTotal(work.criteria);

        // FIX (середній): замість прямого запису в supabase з клієнта —
        // відправляємо на бекенд-ендпоінт з JWT-авторизацією.
        // Це запобігає маніпуляціям через DevTools (обхід перевірки журі).
        const token = (typeof window !== "undefined" && localStorage.getItem("access_token")) || "";

        const res = await fetch(`${API_URL}/api/rounds/${work.round_id}/evaluate`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify({
            submission_id:   work.id,
            criteria_scores: criteriaScores,
            general_comment: work.general_comment,
            total_score:     total,
          }),
        });
        if (!res.ok) {
          const err = await res.json().catch(() => ({}));
          throw new Error(err?.detail ?? `HTTP ${res.status}`);
        }

        // Update local total + status
        setWorks(prev => prev.map((w, i) => {
          if (i !== activeIdx) return w;
          const allFilled = w.criteria.every(c => c.score !== "");
          return { ...w, total_score: total, status: allFilled ? "evaluated" : "in_progress" };
        }));
        setStats(prev => ({
          ...prev,
          evaluated: works.filter((w, i) => {
            if (i === activeIdx) return work.criteria.every(c => c.score !== "");
            return w.status === "evaluated";
          }).length,
        }));

        if (saveMsgTimer.current) clearTimeout(saveMsgTimer.current);
        setSaveMsg({ type: "ok", text: "Оцінку збережено ✓" });
        saveMsgTimer.current = setTimeout(() => setSaveMsg(null), 3000);
      } catch (e: any) {
        setSaveMsg({ type: "err", text: e?.message ?? "Помилка збереження" });
      } finally {
        setSaving(false);
      }
    };

    // ── Redistribute (admin only) ─────────────────────────────────────────────
    const handleRedistribute = async () => {
      if (!isAdmin || !roundId) return;
      setRedistributing(true);
      setSaveMsg(null);
      try {
        const freshToken = (typeof window !== "undefined" ? localStorage.getItem("access_token") : null) ?? "";
        const res = await fetch(`${API_URL}/api/rounds/${roundId}/redistribute`, {
          method: "POST",
          headers: { Authorization: `Bearer ${freshToken}` },
        });
        const json = await res.json().catch(() => ({}));
        if (!res.ok) throw new Error(json.detail ?? `HTTP ${res.status}`);
        setSaveMsg({ type: "ok", text: `Розподілено ${json.submissions} робіт між ${json.jury_count} журі` });
        if (saveMsgTimer.current) clearTimeout(saveMsgTimer.current);
        saveMsgTimer.current = setTimeout(() => setSaveMsg(null), 4000);
        await fetchData();
      } catch (e: any) {
        setSaveMsg({ type: "err", text: e?.message ?? "Помилка перерозподілу" });
      } finally {
        setRedistributing(false);
      }
    };

    // ── Render guards ─────────────────────────────────────────────────────────
    if (authLoading || (!user && !authLoading)) {
      return (
        <div className="min-h-screen bg-(--bg) flex items-center justify-center">
        <div className="w-8 h-8 border-2 border-blue-600 border-t-transparent rounded-full animate-spin" />
        </div>
        <div className="p-6 sm:p-8 space-y-5">
        {/* Назва */}
        <div>
        <div className="flex items-center justify-between mb-2">
        <label className="text-[10px] font-black uppercase tracking-widest text-(--t2)">
        {t.tourney?.name ?? 'Назва турніру'}
        </label>
        <span className="text-[9px] font-black uppercase text-red-500 flex items-center gap-1">
        <Zap className="w-2.5 h-2.5 fill-red-500" /> {t.tourney?.required ?? "Обов'язково"}
        </span>
        </div>
        <input
        type="text"
        value={tourneyName}
        onChange={e => setTourneyName(e.target.value)}
        placeholder={t.tourney?.namePlaceholder ?? 'Назва турніру...'}
        className={inp}
        />
        </div>
        {/* Опис */}
        <div>
        <label className="block text-[10px] font-black uppercase tracking-widest text-(--t2) mb-2">
        {t.tourney?.desc ?? 'Опис / Правила'}
        </label>
        <RichTextEditor
        value={description}
        onChange={setDescription}
        placeholder={t.tourney?.descPlaceholder ?? 'Введіть опис турніру...'}
        rows={7}
        />
        </div>
        </div>
        </section>

    const activeWork = activeIdx !== null ? works[activeIdx] : null;
    const activeTotal = activeWork ? computeTotal(activeWork.criteria) : 0;
    const allCriteriaFilled = activeWork?.criteria.every(c => c.score !== "") ?? false;

        <div className="bg-(--card) rounded-2xl sm:rounded-[2.5rem] shadow-sm border border-(--brd) overflow-hidden flex flex-col">
        <div className="flex items-center gap-3 px-6 py-4 border-b border-(--brd) bg-(--bg)/50">
        <div className="w-8 h-8 rounded-xl bg-gradient-to-br from-green-500 to-emerald-600 flex items-center justify-center text-white flex-shrink-0">
        <Users size={16} />
        </div>
        <span className="text-xs font-black uppercase tracking-widest text-(--t2)">{t.tourney?.regTeams ?? 'Реєстрація команд'}</span>
        </div>
        <div className="p-6 space-y-4 flex-1">
        <DateTimePair label={t.tourney?.regStart ?? 'Початок реєстрації'} dateVal={regStartDate} onDate={setRegStartDate} timeVal={regStartTime} onTime={setRegStartTime} />
        <div className="border-t border-(--brd)" />
        <DateTimePair label={t.tourney?.regEnd ?? 'Кінець реєстрації'} dateVal={regEndDate} onDate={setRegEndDate} timeVal={regEndTime} onTime={setRegEndTime} />
        </div>
        </div>

        <div className="bg-(--card) rounded-2xl sm:rounded-[2.5rem] shadow-sm border border-(--brd) overflow-hidden flex flex-col">
        <div className="flex items-center gap-3 px-6 py-4 border-b border-(--brd) bg-(--bg)/50">
        <div className="w-8 h-8 rounded-xl bg-gradient-to-br from-blue-500 to-blue-600 flex items-center justify-center text-white flex-shrink-0">
        <Clock size={16} />
        </div>
        <span className="text-xs font-black uppercase tracking-widest text-(--t2)">{t.tourney?.startDates ?? 'Дати старту'}</span>
        </div>
        <div className="p-6 space-y-4 flex-1">
        <DateTimePair label={t.tourney?.tourStart ?? 'Початок турніру'} dateVal={startDate} onDate={setStartDate} timeVal={startTime} onTime={setStartTime} required requiredLabel={t.tourney?.required} />
        <div className="border-t border-(--brd)" />
        <DateTimePair label={t.tourney?.tourEnd ?? 'Кінець турніру'} dateVal={endDate} onDate={setEndDate} timeVal={endTime} onTime={setEndTime} />
        </div>
        </div>

        <main className="flex-1 flex flex-col min-w-0 overflow-hidden max-w-full">
        <MobileHeader
        onOpenSidebar={() => setIsMobileSidebarOpen(true)}
        title="Оцінювання"
        icon={<Star size={18} className="text-blue-600" />}
        />

        <div className="flex-1 overflow-y-auto overflow-x-hidden p-4 sm:p-6 relative z-10 w-full max-w-full">

        <div className="bg-(--card) rounded-2xl sm:rounded-[2.5rem] shadow-sm border border-(--brd) overflow-hidden flex flex-col">
        <div className="flex items-center gap-3 px-5 py-4 border-b border-(--brd) bg-(--bg)/50">
        <div className="w-7 h-7 rounded-xl bg-gradient-to-br from-blue-500 to-blue-600 flex items-center justify-center text-white flex-shrink-0">
        <Layers size={14} />
        </div>
        <span className="text-[10px] font-black uppercase tracking-widest text-(--t2) flex-1">{t.tourney?.block3format ?? '3. Формат'}</span>
        <span className="text-[9px] font-black uppercase text-red-500 flex items-center gap-1 whitespace-nowrap">
        <Zap className="w-2 h-2 fill-red-500" /> {t.tourney?.required ?? "Обов'язково"}
        </span>
        </div>
        <div className="p-5 flex flex-col gap-3 flex-1">
        <div className="flex items-center justify-between">
        <p className="text-[9px] font-black uppercase tracking-widest text-(--t2)">{t.tourney?.roundCount ?? 'Кількість раундів'}</p>
        <p className="text-[9px] font-black uppercase tracking-widest text-(--t2)">
        {t.tourney?.roundSelected ?? 'Вибрано:'} <span className="text-blue-500">{roundCount}</span> {roundCount === 1 ? (t.tourney?.roundWord_1 ?? 'раунд') : roundCount < 5 ? (t.tourney?.roundWord_2 ?? 'раунди') : (t.tourney?.roundWord_5 ?? 'раундів')}
        </p>
        </div>
        <div className="grid grid-cols-4 gap-1.5">
        {[1, 2, 3, 4, 5, 6, 7, 8].map(n => (
          <button key={n} type="button"
          onClick={() => { setRoundCount(n); if (selectedRoundTab > n) setSelectedRoundTab(1); }}
          className={`h-10 rounded-xl font-black text-sm border transition-all duration-150 active:scale-90 ${
            n === roundCount
            ? 'bg-blue-600 border-blue-600 text-white shadow-md shadow-blue-600/30'
            : n <= roundCount
            ? 'bg-blue-500/10 border-blue-500/40 text-blue-500'
            : 'bg-(--bg) border-(--brd) text-(--t2) hover:border-blue-600/50 hover:text-blue-600'
          }`}>
          {n}
          </button>
        ))}
        </div>
        </div>
        </div>

        <div className="bg-(--card) rounded-2xl sm:rounded-[2.5rem] shadow-sm border border-(--brd) overflow-hidden flex flex-col">
        <div className="flex items-center gap-3 px-5 py-4 border-b border-(--brd) bg-(--bg)/50">
        <div className="w-7 h-7 rounded-xl bg-gradient-to-br from-purple-500 to-purple-600 flex items-center justify-center text-white flex-shrink-0">
        <Users size={14} />
        </div>
        <span className="text-[10px] font-black uppercase tracking-widest text-(--t2) flex-1">{t.tourney?.teamCount ?? 'Команди'}</span>
        <span className="text-[9px] font-bold text-(--t2) bg-(--bg) border border-(--brd) px-2 py-0.5 rounded-full whitespace-nowrap">
        {t.common?.optional ?? 'Опціонально'}
        </span>
        </div>
        <div className="p-5 flex flex-col gap-3 flex-1">
        <p className="text-[9px] font-black uppercase tracking-widest text-(--t2)">{t.tourney?.teamCount ?? 'Кількість команд'}</p>
        <div className="flex items-center justify-center gap-3 flex-1">
        <button type="button"
        onClick={() => setTeamCount(Math.max(0, teamCount - 1))}
        className="w-9 h-9 rounded-xl bg-(--bg) border border-(--brd) flex items-center justify-center text-(--t2) hover:text-blue-600 hover:border-blue-600/40 transition-all active:scale-90 font-black text-lg flex-shrink-0">−</button>
        <input
        type="number"
        min={0}
        value={teamCount === 0 ? '' : teamCount}
        onChange={e => {
          const v = parseInt(e.target.value, 10);
          setTeamCount(isNaN(v) || v < 0 ? 0 : v);
        }}
        placeholder="∞"
        className="w-16 text-center text-2xl font-black bg-transparent outline-none text-(--t1) placeholder:text-(--t2)/60 border-b-2 border-(--brd) focus:border-blue-500 transition-colors tabular-nums [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
        />
        <button type="button"
        onClick={() => setTeamCount(teamCount + 1)}
        className="w-9 h-9 rounded-xl bg-(--bg) border border-(--brd) flex items-center justify-center text-(--t2) hover:text-blue-600 hover:border-blue-600/40 transition-all active:scale-90 font-black text-lg flex-shrink-0">+</button>
        </div>
        <div className="flex gap-1.5 flex-wrap justify-center">
        {[0, 8, 16, 32, 64].map(n => (
          <button key={n} type="button" onClick={() => setTeamCount(n)}
          className={`text-[10px] font-black px-3 py-1.5 rounded-full border uppercase tracking-widest transition-all active:scale-95 ${
            teamCount === n
            ? 'bg-blue-600 border-blue-600 text-white shadow-sm shadow-blue-600/30'
            : 'bg-(--bg) border-(--brd) text-(--t2) hover:border-blue-600/50 hover:text-blue-600'
          }`}>
          {n === 0 ? (t.tourney?.noLimit ?? 'Без ліміту') : n}
          </button>
          <button
          onClick={() => setMobileTab("form")}
          className={`flex-1 flex items-center justify-center gap-2 py-3 rounded-xl font-black text-[10px] uppercase tracking-widest transition-all ${
            mobileTab === "form" ? "bg-blue-600 text-white shadow-md" : "text-(--t2) hover:text-(--t1)"
          }`}
          >
          <Star size={13} />
          <span className="truncate max-w-[110px]">{activeWork ? activeWork.team_name : "Оцінка"}</span>
          {activeWork && (
            <span className={`w-2 h-2 rounded-full flex-shrink-0 ${
              activeWork.status === "evaluated" ? "bg-green-500" :
              activeWork.status === "in_progress" ? "bg-amber-500" : "bg-(--brd)"
            }`} />
          )}
          </button>
          </div>

          {/* ══ LEFT — Submission list + Stats ═══════════════════════════ */}
          <div className={`w-full xl:w-[320px] flex-shrink-0 flex-col gap-4 ${mobileTab === "list" ? "flex" : "hidden xl:flex"}`}>

        {/* Action buttons */}
        <div className="cdIn flex flex-col sm:flex-row gap-3" style={{ animationDelay: '200ms' }}>
        <button type="submit" disabled={isSubmitting}
        className="flex-1 px-8 py-4 bg-blue-600 text-white rounded-2xl font-black text-xs uppercase tracking-widest hover:bg-blue-700 active:scale-95 transition-all shadow-lg shadow-blue-600/20 disabled:opacity-60 disabled:cursor-not-allowed flex items-center justify-center gap-2">
        {isSubmitting && <span className="w-4 h-4 border-2 border-white/40 border-t-white rounded-full animate-spin" />}
        {isSubmitting ? (t.tourney?.saving ?? 'Зберігається...') : (t.tourney?.createBtn ?? 'Створити турнір')}
        </button>
        <button type="button" onClick={() => router.back()} disabled={isSubmitting}
        className="flex-1 px-8 py-4 bg-(--bg) border border-(--brd) text-(--t2) rounded-2xl font-black text-xs uppercase tracking-widest hover:bg-(--card) active:scale-95 transition-all disabled:opacity-60">
        {t.common?.cancel ?? 'Скасувати'}
        </button>
        </div>

        </div>
        {/* end LEFT COLUMN */}

        {/* ── RIGHT COLUMN ── */}
        <div className="w-full xl:sticky xl:top-6 xl:flex-1 xl:min-w-0">
        <RoundSettingsPanel
        roundCount={roundCount}
        selectedRound={selectedRoundTab}
        onSelectRound={setSelectedRoundTab}
        onRoundsChange={setRoundsData}
        labels={t.roundPanel}
        />
        </div>

          </div>

          {/* ══ RIGHT — Evaluation form ═══════════════════════════════════ */}
          <div className={`flex-1 min-w-0 flex-col gap-4 ${mobileTab === "form" ? "flex" : "hidden xl:flex"}`}>

          {activeWork ? (
            <>
            {/* ── Work header: team card + score island ── */}
            <div className="cdIn flex flex-col sm:flex-row gap-3 items-stretch">

            {/* MAIN INFO CARD */}
            <div className="flex-1 min-w-0 bg-(--card) rounded-2xl sm:rounded-[2rem] border border-(--brd) shadow-sm overflow-hidden">

            {/* ── Mobile layout ── */}
            <div className="sm:hidden">
            {/* Top: avatar + team name + score */}
            <div className="flex items-center gap-3 p-4">
            <div className="flex-shrink-0 w-12 h-12 rounded-xl overflow-hidden border border-(--brd)">
            {activeWork.team_avatar_url
              ? <img src={activeWork.team_avatar_url} alt={activeWork.team_name} className="w-full h-full object-cover" />
              : <div className="w-full h-full bg-blue-600/10 flex items-center justify-center text-blue-600 font-black text-xl">{activeWork.team_name.charAt(0).toUpperCase()}</div>
            }
            </div>
            <div className="flex-1 min-w-0">
            <h2 className="font-black text-(--t1) text-base uppercase tracking-tight truncate">{activeWork.team_name}</h2>
            {activeWork.team_org && <p className="text-[10px] font-bold text-(--t2) truncate">{activeWork.team_org}</p>}
            {(activeWork as any).team_leader && (
              <div className="flex items-center gap-1 mt-0.5 flex-wrap">
              <span className="text-[10px] font-bold text-(--t2) truncate max-w-[120px]">{(activeWork as any).team_leader}</span>
              <span className="text-[8px] font-black uppercase px-1.5 py-0.5 rounded bg-orange-500/10 text-orange-400 border border-orange-500/20">капітан</span>
              </div>
            )}
            </div>
            {/* Inline score badge */}
            <div className={`flex-shrink-0 flex flex-col items-center justify-center w-14 h-14 rounded-2xl border font-black text-2xl ${
              activeTotal >= 80 ? "text-green-500 bg-green-500/10 border-green-500/20" :
              activeTotal >= 50 ? "text-blue-500 bg-blue-500/10 border-blue-500/20" :
              activeTotal >  0  ? "text-amber-500 bg-amber-500/10 border-amber-500/20" :
              "text-(--t2) bg-(--bg) border-(--brd)"
            }`} style={{ fontVariantNumeric: "tabular-nums" }}>
            {activeWork.criteria.every(c => c.score !== "") || activeTotal > 0 ? activeTotal : "—"}
            </div>
            </div>
            {/* Bottom: link buttons row — icon-only on mobile, icon+text on sm+ */}
            <div className="flex items-center gap-2 px-4 pb-4 border-t border-(--brd) pt-3">
            {activeWork.github_url ? (
              <a href={activeWork.github_url} target="_blank" rel="noopener noreferrer" title="GitHub"
              className="flex-1 flex items-center justify-center gap-1.5 py-2.5 rounded-xl border border-(--brd) bg-(--bg) text-(--t2) font-black text-[9px] uppercase tracking-widest hover:text-blue-600 hover:border-blue-600/40 active:scale-95 transition-all min-w-0">
              <Github size={13} className="flex-shrink-0" /><span className="hidden xs:inline truncate">GitHub</span>
              </a>
            ) : (
              <span className="flex-1 flex items-center justify-center py-2.5 rounded-xl border border-(--brd) text-(--t2) opacity-30 cursor-not-allowed min-w-0">
              <Github size={13} />
              </span>
            )}
            {activeWork.youtube_url ? (
              <a href={activeWork.youtube_url} target="_blank" rel="noopener noreferrer" title="YouTube"
              className="flex-1 flex items-center justify-center gap-1.5 py-2.5 rounded-xl border border-(--brd) bg-(--bg) text-(--t2) font-black text-[9px] uppercase tracking-widest hover:text-red-500 hover:border-red-500/40 active:scale-95 transition-all min-w-0">
              <Video size={13} className="flex-shrink-0" /><span className="hidden xs:inline truncate">YouTube</span>
              </a>
            ) : (
              <span className="flex-1 flex items-center justify-center py-2.5 rounded-xl border border-(--brd) text-(--t2) opacity-30 cursor-not-allowed min-w-0">
              <Video size={13} />
              </span>
            )}
            {activeWork.live_url ? (
              <a href={activeWork.live_url} target="_blank" rel="noopener noreferrer" title="Live Demo"
              className="flex-1 flex items-center justify-center gap-1.5 py-2.5 rounded-xl border border-(--brd) bg-(--bg) text-(--t2) font-black text-[9px] uppercase tracking-widest hover:text-green-500 hover:border-green-500/40 active:scale-95 transition-all min-w-0">
              <Zap size={13} className="flex-shrink-0" /><span className="hidden xs:inline truncate">Live</span>
              </a>
            ) : (
              <span className="flex-1 flex items-center justify-center py-2.5 rounded-xl border border-(--brd) text-(--t2) opacity-30 cursor-not-allowed min-w-0">
              <Zap size={13} />
              </span>
            )}
            {(() => {
              const rf = (activeWork.files ?? []).find(f => f.name?.toLowerCase().includes("readme") && f.url);
              const roundDesc = round?.description ?? "";
              const roundDescText = roundDesc.replace(/<[^>]*>/g, "").trim();
              const hasReadme = !!rf?.url || roundDescText.length > 0;
              return hasReadme ? (
                <button onClick={() => setReadmeModal(rf?.url ? { url: rf.url, title: "README" } : { text: round!.description, title: `Опис: ${round!.name}` })} title="README"
                className="flex-1 flex items-center justify-center gap-1.5 py-2.5 rounded-xl border border-(--brd) bg-(--bg) text-(--t2) font-black text-[9px] uppercase tracking-widest hover:text-blue-600 hover:border-blue-600/40 active:scale-95 transition-all min-w-0">
                <Eye size={13} className="flex-shrink-0" /><span className="hidden xs:inline truncate">README</span>
                </button>
              ) : (
                <span className="flex-1 flex items-center justify-center py-2.5 rounded-xl border border-(--brd) text-(--t2) opacity-30 cursor-not-allowed min-w-0">
                <Eye size={13} />
                </span>
              );
            })()}
            </div>
            </div>

            {/* ── Desktop layout ── */}
            <div className="hidden sm:flex items-stretch">
            {/* LEFT — avatar + team info */}
            <div className="flex items-center gap-4 p-5 sm:p-6 flex-1 min-w-0">
            <div className="flex-shrink-0">
            <div className="w-20 h-20 rounded-2xl overflow-hidden border-2 border-(--brd) shadow-md">
            {activeWork.team_avatar_url
              ? <img src={activeWork.team_avatar_url} alt={activeWork.team_name} className="w-full h-full object-cover" />
              : <div className="w-full h-full bg-blue-600/10 border border-blue-600/20 flex items-center justify-center text-blue-600 font-black text-3xl">{activeWork.team_name.charAt(0).toUpperCase()}</div>
            }
            </div>
            </div>
            <div className="flex flex-col justify-center gap-1 min-w-0">
            <h2 className="font-black text-(--t1) text-xl uppercase tracking-tight truncate">{activeWork.team_name}</h2>
            {activeWork.team_org && <p className="text-[11px] font-bold text-(--t2) uppercase tracking-wider truncate">{activeWork.team_org}</p>}
            {(activeWork as any).team_leader && (
              <div className="flex items-center gap-1.5 mt-0.5">
              <Shield size={11} className="text-(--t2) flex-shrink-0" />
              <span className="text-[11px] font-bold text-(--t2) truncate">{(activeWork as any).team_leader}</span>
              <span className="ml-1 text-[9px] font-black uppercase tracking-wider px-1.5 py-0.5 rounded-md bg-orange-500/10 text-orange-400 border border-orange-500/20">капітан</span>
              </div>
            )}
            <div className="flex items-center gap-1.5 mt-0.5">
            <Clock size={11} className="text-(--t2) flex-shrink-0" />
            <span className="text-[11px] font-bold text-(--t2)">Здано: {fmtDate(activeWork.submitted_at)}</span>
            </div>
            </div>
            </div>
            {/* RIGHT — video + buttons */}
            <div className="flex items-stretch border-l border-(--brd)">
            <div className="flex flex-col items-center justify-center p-3 bg-(--bg)/40 gap-2">
            <div className="w-28 h-[72px] rounded-xl overflow-hidden border border-(--brd) shadow-sm relative flex-shrink-0">
            {activeWork.youtube_url ? (
              <a href={activeWork.youtube_url} target="_blank" rel="noopener noreferrer" className="block w-full h-full group">
              <img src={`https://img.youtube.com/vi/${activeWork.youtube_url.match(/(?:v=|youtu\.be\/)([^&\n?#]+)/)?.[1]}/hqdefault.jpg`} alt="preview" className="w-full h-full object-cover" />
              <div className="absolute inset-0 flex items-center justify-center">
              <div className="w-7 h-7 rounded-full bg-black/60 flex items-center justify-center"><Video size={12} className="text-white ml-0.5" /></div>
              </div>
              </a>
            ) : (
              <div className="w-full h-full bg-(--bg) flex flex-col items-center justify-center gap-1">
              <Video size={16} className="text-(--t2) opacity-25" />
              <span className="text-[8px] font-black uppercase text-(--t2) opacity-30 text-center leading-tight px-1">Відео відсутнє</span>
              </div>
            )}
            </div>
            {activeWork.youtube_url ? (
              <a href={activeWork.youtube_url} target="_blank" rel="noopener noreferrer" className="w-full flex items-center justify-center gap-1.5 px-2 py-1.5 rounded-lg bg-(--bg) border border-(--brd) text-(--t2) font-black text-[9px] uppercase tracking-widest hover:border-red-500/40 hover:text-red-500 transition-all active:scale-95"><Video size={10} /> YouTube</a>
            ) : (
              <span className="w-full flex items-center justify-center gap-1.5 px-2 py-1.5 rounded-lg border border-(--brd) text-(--t2) opacity-30 font-black text-[9px] uppercase tracking-widest cursor-not-allowed"><Video size={10} /> YouTube</span>
            )}
            </div>
            <div className="flex flex-col justify-center gap-2 px-4 py-4 min-w-[120px]">
            {activeWork.github_url ? (
              <a href={activeWork.github_url} target="_blank" rel="noopener noreferrer" className="flex items-center gap-2 px-3 py-2 rounded-xl bg-(--bg) border border-(--brd) text-(--t2) font-black text-[10px] uppercase tracking-widest hover:border-blue-600/40 hover:text-blue-600 transition-all active:scale-95"><Github size={11} /> GitHub</a>
            ) : (
              <span className="flex items-center gap-2 px-3 py-2 rounded-xl border border-(--brd) text-(--t2) opacity-30 font-black text-[10px] uppercase tracking-widest cursor-not-allowed"><Github size={11} /> GitHub</span>
            )}
            {activeWork.live_url ? (
              <a href={activeWork.live_url} target="_blank" rel="noopener noreferrer" className="flex items-center gap-2 px-3 py-2 rounded-xl bg-(--bg) border border-(--brd) text-(--t2) font-black text-[10px] uppercase tracking-widest hover:border-green-500/40 hover:text-green-500 transition-all active:scale-95"><Zap size={11} /> Live Demo</a>
            ) : (
              <span className="flex items-center gap-2 px-3 py-2 rounded-xl border border-(--brd) text-(--t2) opacity-30 font-black text-[10px] uppercase tracking-widest cursor-not-allowed"><Zap size={11} /> Live Demo</span>
            )}
            {(() => {
              const rf = (activeWork.files ?? []).find(f => f.name?.toLowerCase().includes("readme") && f.url);
              const roundDesc2 = round?.description ?? "";
              const roundDescText2 = roundDesc2.replace(/<[^>]*>/g, "").trim();
              const hasReadme = !!rf?.url || roundDescText2.length > 0;
              return hasReadme ? (
                <button onClick={() => setReadmeModal(rf?.url ? { url: rf.url, title: "README" } : { text: round!.description, title: `Опис: ${round!.name}` })} className="flex items-center gap-2 px-3 py-2 rounded-xl bg-(--bg) border border-(--brd) text-(--t2) font-black text-[10px] uppercase tracking-widest hover:border-blue-600/40 hover:text-blue-600 transition-all active:scale-95"><Eye size={11} /> README</button>
              ) : (
                <span className="flex items-center gap-2 px-3 py-2 rounded-xl border border-(--brd) text-(--t2) opacity-30 font-black text-[10px] uppercase tracking-widest cursor-not-allowed"><Eye size={11} /> README</span>
              );
            })()}
            </div>
            </div>
            </div>

            </div>

            {/* SCORE ISLAND — hidden on mobile (shown inline above), visible on sm+ */}
            <div className="hidden sm:flex flex-shrink-0 bg-(--card) rounded-2xl sm:rounded-[2rem] border border-(--brd) shadow-sm flex-col items-center justify-center px-6 py-5 gap-2" style={{ width: 140, minWidth: 140 }}>
            <div className={`text-4xl font-black rounded-2xl border flex items-center justify-center ${
              activeTotal >= 80 ? "text-green-500 bg-green-500/10 border-green-500/20" :
              activeTotal >= 50 ? "text-blue-500 bg-blue-500/10 border-blue-500/20" :
              activeTotal >  0  ? "text-amber-500 bg-amber-500/10 border-amber-500/20" :
              "text-(--t2) bg-(--bg) border-(--brd)"
            }`} style={{ width: 104, height: 60, fontVariantNumeric: "tabular-nums" }}>
            {activeWork.criteria.every(c => c.score !== "") || activeTotal > 0 ? activeTotal : "—"}
            </div>
            <span className="text-[8px] font-black uppercase tracking-widest text-(--t2) text-center leading-tight">
            Підсумкова<br/>оцінка (авто)
            </span>
            </div>

            </div>

            {/* Criteria scores */}
            <div className="cdIn bg-(--card) rounded-2xl sm:rounded-[2rem] border border-(--brd) shadow-sm overflow-hidden" style={{ animationDelay: "50ms" }}>
            <div className="flex items-center gap-3 px-5 sm:px-6 py-4 border-b border-(--brd) bg-(--bg)/40">
            <Award size={14} className="text-blue-600" />
            <h3 className="text-[10px] font-black uppercase tracking-widest text-(--t1)">
            Форма оцінки (по категоріях)
            </h3>
            </div>

            {/* Criteria table header */}
            <div className="hidden sm:grid grid-cols-[1fr_40px_1fr_96px] gap-3 px-5 sm:px-6 py-3 border-b border-(--brd) bg-(--bg)/20">
            {["Категорія", "Вага", "Оцінка (0–100)", "Коментар"].map(h => (
              <span key={h} className="text-[9px] font-black uppercase tracking-widest text-(--t2)">{h}</span>
            ))}
            </div>

            <div className="divide-y divide-(--brd)">
            {activeWork.criteria.map((crit, ci) => (
              <div key={crit.key} className="fuIn px-5 sm:px-6 py-4" style={{ animationDelay: `${ci * 40}ms` }}>
              {/* Mobile: stacked layout */}
              <div className="sm:hidden mb-3 flex items-center justify-between">
              <span className="text-sm font-black text-(--t1)">{crit.label}</span>
              <span className="text-[10px] font-black px-2 py-0.5 rounded-lg bg-blue-600/10 text-blue-600 border border-blue-600/20">
              {crit.weight}%
              </span>
              </div>
              {/* Desktop: grid */}
              <div className="hidden sm:grid grid-cols-[1fr_40px_1fr_96px] gap-3 items-center">
              <span className="text-sm font-bold text-(--t1)">{crit.label}</span>
              <span className="text-[10px] font-black text-center text-blue-600 bg-blue-600/8 rounded-lg py-1">{crit.weight}%</span>
              <ScoreInput
              value={crit.score}
              onChange={v => updateCriterionScore(crit.key, v)}
              />
              <input
              type="text"
              placeholder="Коментар..."
              value={crit.comment}
              onChange={e => updateCriterionComment(crit.key, e.target.value)}
              className="w-full px-3 py-2 rounded-xl border border-(--brd) bg-(--bg) text-(--t1) text-xs font-medium focus:ring-2 focus:ring-blue-500/20 focus:border-blue-600 outline-none transition-all placeholder:text-(--t2)/40"
              />
              </div>
              {/* Mobile score + comment */}
              <div className="sm:hidden space-y-2">
              <ScoreInput
              value={crit.score}
              onChange={v => updateCriterionScore(crit.key, v)}
              />
              <input
              type="text"
              placeholder="Коментар..."
              value={crit.comment}
              onChange={e => updateCriterionComment(crit.key, e.target.value)}
              className="w-full px-3 py-2 rounded-xl border border-(--brd) bg-(--bg) text-(--t1) text-xs font-medium focus:ring-2 focus:ring-blue-500/20 focus:border-blue-600 outline-none transition-all"
              />
              </div>
              </div>
            ))}
            </div>

            {/* Total row */}
            <div className="flex items-center justify-between px-5 sm:px-6 py-4 border-t-2 border-(--brd) bg-(--bg)/30">
            <span className="text-[10px] font-black uppercase tracking-widest text-(--t2)">
            Підсумкова оцінка (авто)
            </span>
            <div className="flex items-center gap-2">
            <div style={{ width: 64, textAlign: "right" }}>
            <span className={`text-2xl font-black ${
              !allCriteriaFilled      ? "text-(--t2)" :
              activeTotal >= 80       ? "text-green-500" :
              activeTotal >= 50       ? "text-blue-500" :
              "text-amber-500"
            }`} style={{ fontVariantNumeric: "tabular-nums" }}>
            {allCriteriaFilled ? activeTotal : "—"}
            </span>
            </div>
            <span className="text-[9px] font-bold text-(--t2) uppercase">/ 100</span>
            </div>
            </div>
            </div>

            {/* General comment */}
            <div className="cdIn bg-(--card) rounded-2xl sm:rounded-[2rem] border border-(--brd) shadow-sm p-5 sm:p-6" style={{ animationDelay: "100ms" }}>
            <label className="block text-[10px] font-black uppercase tracking-widest text-(--t2) mb-3">
            Опціональний загальний коментар
            </label>
            <textarea
            rows={3}
            placeholder="Загальні враження від роботи, рекомендації..."
            value={activeWork.general_comment}
            onChange={e => updateGeneralComment(e.target.value)}
            className="w-full px-4 py-3 rounded-xl border border-(--brd) bg-(--bg) text-(--t1) text-sm font-medium focus:ring-2 focus:ring-blue-500/20 focus:border-blue-600 outline-none transition-all resize-none placeholder:text-(--t2)/40"
            />
            </div>

            {/* Action bar */}
            <div className="cdIn flex flex-col gap-3" style={{ animationDelay: "130ms" }}>
            {/* Save + Cancel */}
            <div className="flex items-center gap-3">
            <button
            onClick={handleSave}
            disabled={saving}
            className={`flex-1 sm:flex-none flex items-center justify-center gap-2 px-8 py-4 rounded-2xl font-black text-[11px] uppercase tracking-widest transition-all active:scale-95 shadow-lg ${
              saving
              ? "bg-(--brd) text-(--t2) cursor-not-allowed shadow-none"
              : allCriteriaFilled
              ? "bg-green-600 text-white hover:bg-green-700 shadow-green-600/25"
              : "bg-blue-600 text-white hover:bg-blue-700 shadow-blue-600/25"
            }`}
            >
            {saving
              ? <><Loader size={14} className="animate-spin" /> Збереження...</>
              : allCriteriaFilled
              ? <><CheckCircle2 size={14} /> Зберегти оцінку</>
              : <><Save size={14} /> Зберегти оцінку</>
            }
            </button>
            <button
            onClick={() => { fetchData(); setSaveMsg(null); }}
            className="flex items-center gap-2 px-4 py-4 rounded-2xl font-black text-[11px] uppercase tracking-widest border border-(--brd) bg-(--bg) text-(--t2) hover:bg-(--card) hover:text-(--t1) active:scale-95 transition-all"
            >
            <RefreshCw size={14} /><span className="hidden sm:inline"> Відмінити</span>
            </button>
            {saveMsg && (
              <div className={`flex items-center gap-2 px-4 py-3 rounded-2xl text-[11px] font-black uppercase tracking-widest ${
                saveMsg.type === "ok"
                ? "bg-green-500/10 border border-green-500/20 text-green-500"
                : "bg-red-500/10 border border-red-500/20 text-red-500"
              }`}>
              {saveMsg.type === "ok" ? <CheckCircle2 size={13} /> : <AlertCircle size={13} />}
              <span className="hidden sm:inline">{saveMsg.text}</span>
              </div>
            )}
            </div>
            {/* Prev / Next — full width on mobile */}
            <div className="flex items-center gap-2">
            <button
            onClick={() => setActiveIdx(i => (i !== null && i > 0) ? i - 1 : i)}
            disabled={activeIdx === 0 || activeIdx === null}
            className="flex-1 px-4 py-3 rounded-xl border border-(--brd) bg-(--bg) text-(--t2) font-black text-[10px] uppercase tracking-widest hover:border-blue-600/40 hover:text-blue-600 active:scale-95 transition-all disabled:opacity-30 text-center"
            >
            ← Попередня
            </button>
            <button
            onClick={() => setActiveIdx(i => (i !== null && i < works.length - 1) ? i + 1 : i)}
            disabled={activeIdx === works.length - 1 || activeIdx === null}
            className="flex-1 px-4 py-3 rounded-xl border border-(--brd) bg-(--bg) text-(--t2) font-black text-[10px] uppercase tracking-widest hover:border-blue-600/40 hover:text-blue-600 active:scale-95 transition-all disabled:opacity-30 text-center"
            >
            Наступна →
            </button>
            </div>
            </div>
            </>
          ) : (
            /* Empty state */
            <div className="cdIn bg-(--card) rounded-2xl sm:rounded-[2rem] border border-(--brd) shadow-sm flex flex-col items-center justify-center py-24 text-center gap-4 px-8">
            <div className="w-16 h-16 rounded-2xl bg-(--bg) border border-(--brd) flex items-center justify-center">
            <Star size={28} className="text-(--t2) opacity-30" />
            </div>
            <p className="font-black text-(--t1) text-base uppercase">
            {works.length === 0
              ? "Немає робіт для оцінювання"
              : "Оберіть роботу зі списку"
            }
            </p>
            <p className="text-sm text-(--t2) max-w-xs">
            {works.length === 0 && isJury
              ? "Адміністратор ще не розподілив роботи між журі. Очікуйте повідомлення."
              : "Натисніть на картку команди зліва, щоб розпочати оцінювання"
            }
            </p>
            </div>
          )}
          </div>
          </div>
        )}
        </div>
        </main>
        {/* README Modal */}
        {readmeModal && (
          <ReadmeModal url={readmeModal.url} text={readmeModal.text} title={readmeModal.title} onClose={() => setReadmeModal(null)} />
        )}
        </div>
    );
}
