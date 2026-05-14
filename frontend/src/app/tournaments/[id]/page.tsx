// src/app/tournaments/[id]/page.tsx
"use client";

import React, { useEffect, useState } from "react";
import { useRouter, useParams } from "next/navigation";
import { supabase } from "@/lib/supabase";
import { useSidebar } from "@/context/SidebarContext";
import { useAuth } from "@/context/AuthContext";
import { useTheme } from "@/hooks/useTheme";
import Sidebar from "@/components/Sidebar";
import MobileHeader from "@/components/MobileHeader";
import { LeaderboardSection } from "@/components/LeaderboardSection";
import { Trophy, Users, ArrowLeft, Loader, Edit, ChevronRight, Clock, Flag, Lock, LayoutList, Star } from "lucide-react";
import { MarkdownRenderer } from "@/components/MarkdownRenderer";

const API_URL =
typeof window !== "undefined" && window.location.hostname === "localhost"
? "http://localhost:8000"
: "https://site-turing-crutchmasters-team-s.onrender.com";

interface Round {
    id: string;
    tournament_id: string;
    number: number;
    name: string;
    description?: string;
    start_at?: string;
    end_at?: string;
    status?: string;
}

interface Team {
    id: string;
    name: string;
    city_school_org?: string;
    captain_id?: string;
    members_ids?: string[];
    avatar_url?: string;
}

interface JuryMember {
    jury_id: string;
    username: string;
    avatar_url?: string;
}

interface Tournament {
    id: string;
    name: string;
    rules?: string;
    max_teams?: number;
    rounds?: number;
    status: string;
    start_at?: string;
    end_at?: string;
    registration_from?: string;
    registration_to?: string;
    banner_url?: string;
    teams: Team[];
}

type Tab = "info" | "leaderboard";

function fmtDate(iso?: string) {
    if (!iso) return "—";
    return new Date(iso).toLocaleString("uk-UA", {
        day: "numeric", month: "long", year: "numeric",
        hour: "2-digit", minute: "2-digit" });
}

export default function TournamentPage() {
    const { mobileOpen: isMobileSidebarOpen, openMobile, closeMobile: closeMobileSidebar, isClosing: isSidebarClosing } = useSidebar();
  const router = useRouter();
    const params = useParams();
    const { user, isLoading: authLoading } = useAuth();
    const { dark } = useTheme();
    const id = params?.id as string;

    const [tournament, setTournament] = useState<Tournament | null>(null);
    const [rounds, setRounds] = useState<Round[]>([]);
    const [jury, setJury] = useState<JuryMember[]>([]);
    const [loading, setLoading] = useState(true);
    const [registering, setRegistering] = useState(false);
    const [unregistering, setUnregistering] = useState(false);
    const [registerError, setRegisterError] = useState<string | null>(null);
    const [activeTab, setActiveTab] = useState<Tab>("info");
    const [leaderboardTouched, setLeaderboardTouched] = useState(false);

    useEffect(() => { if (id && !authLoading) fetchTournament(); }, [id, authLoading]);

    const fetchTournament = async () => {
        setLoading(true);
        try {
            const { data: tourData, error: tourErr } = await supabase
            .from("tournaments")
            .select("id, name, rules, max_teams, rounds, status, start_at, end_at, registration_from, registration_to, banner_url")
            .eq("id", id)
            .single();
            if (tourErr) throw tourErr;

            const { data: teamsData, error: teamsErr } = await supabase
            .from("teams")
            .select("id, name, city_school_org, captain_id, members_ids, avatar_url")
            .eq("tournament_id", id);
            if (teamsErr) throw teamsErr;

            setTournament({ ...tourData, teams: teamsData ?? [] });

            const { data: roundsData } = await supabase
            .from("rounds")
            .select("id, tournament_id, number, name, description, start_at, end_at, status")
            .eq("tournament_id", id)
            .order("number", { ascending: true });
            setRounds(roundsData ?? []);

            // Fetch accepted jury members for this tournament
            const { data: juryInvites } = await supabase
            .from("jury_tournament_invitations")
            .select("jury_id")
            .eq("tournament_id", id)
            .eq("status", "accepted");

            if (juryInvites && juryInvites.length > 0) {
                const juryIds = [...new Set(juryInvites.map((j: any) => j.jury_id))];
                const { data: juryAccounts } = await supabase
                .from("account")
                .select("id, username, avatar_url")
                .in("id", juryIds);
                const accountMap: Record<string, any> = {};
                (juryAccounts ?? []).forEach((a: any) => { accountMap[a.id] = a; });
                setJury(juryIds.map(jid => ({
                    jury_id: jid,
                    username: accountMap[jid]?.username ?? "—",
                    avatar_url: accountMap[jid]?.avatar_url ?? null,
                })));
            } else {
                setJury([]);
            }
        } catch (e) {
            console.error(e);
        } finally {
            setLoading(false);
        }
    };

    const [teamPickerOpen, setTeamPickerOpen] = useState(false);
    const [eligibleTeams, setEligibleTeams] = useState<{ id: string; name: string }[]>([]);

    const handleRegister = async () => {
        if (!user || !tournament) return;
        setRegisterError(null);

        const { data: captainTeams, error: teamErr } = await supabase
        .from("teams")
        .select("id, name, tournament_id")
        .eq("captain_id", user.id);

        if (teamErr || !captainTeams || captainTeams.length === 0) {
            setRegisterError("У вас немає команди або ви не є капітаном жодної команди");
            return;
        }

        const eligible = captainTeams.filter(t => !t.tournament_id);
        if (eligible.length === 0) {
            setRegisterError("Всі ваші команди вже зареєстровані в турнірах");
            return;
        }

        if (eligible.length === 1) {
            await doRegister(eligible[0].id);
        } else {
            setEligibleTeams(eligible);
            setTeamPickerOpen(true);
        }
    };

    const doRegister = async (teamId: string) => {
        setTeamPickerOpen(false);
        setRegistering(true);
        try {
            const token = (typeof window !== "undefined" && localStorage.getItem("access_token")) || "";
            const res = await fetch(`${API_URL}/api/tournaments/register`, {
                method: "POST",
                headers: {
                    "Content-Type": "application/json",
                    Authorization: `Bearer ${token}`,
                },
                body: JSON.stringify({
                    team_id: teamId,
                    tournament_id: id,
                }),
            });

            const data = await res.json();

            if (!res.ok) {
                setRegisterError(data.detail ?? "Помилка реєстрації");
                return;
            }

            await fetchTournament();
        } catch (e: any) {
            setRegisterError("Помилка з'єднання з сервером: " + e.message);
        } finally {
            setRegistering(false);
        }
    };

    const handleUnregister = async () => {
        if (!user || !tournament || !myTeamInTournament) return;
        setRegisterError(null);
        setUnregistering(true);
        try {
            const token = (typeof window !== "undefined" && localStorage.getItem("access_token")) || "";
            const res = await fetch(`${API_URL}/api/tournaments/unregister`, {
                method: "DELETE",
                headers: {
                    "Content-Type": "application/json",
                    Authorization: `Bearer ${token}`,
                },
                body: JSON.stringify({
                    team_id: myTeamInTournament.id,
                    tournament_id: id,
                }),
            });
            const data = await res.json();
            if (!res.ok) {
                setRegisterError(data.detail ?? "Помилка скасування реєстрації");
                return;
            }
            await fetchTournament();
        } catch (e: any) {
            setRegisterError("Помилка з'єднання з сервером: " + e.message);
        } finally {
            setUnregistering(false);
        }
    };

    if (authLoading || loading || !tournament) {
        return (
            <div className="min-h-screen bg-(--bg) flex items-center justify-center">
            <Loader className="animate-spin text-blue-600" />
            </div>
        );
    }

    const teamCount = tournament.teams?.length ?? 0;
    const isFull = !!tournament.max_teams && teamCount >= tournament.max_teams;
    const isAdmin = user?.role === "admin" || user?.role === "superadmin";
    const isRegistrationOpen = tournament.status === "registration";
    const isFinished = tournament.status === "finished";
    const myTeamInTournament = tournament.teams?.find(
        t => t.captain_id === user?.id || (t.members_ids as string[] | undefined)?.includes(user?.id ?? "")
    );

    const tabs: { key: Tab; label: string; icon: React.ReactNode }[] = [
        { key: "info", label: "Огляд", icon: <LayoutList size={14} /> },
        { key: "leaderboard", label: "Лідербоард", icon: <Trophy size={14} /> },
    ];

    const handleTabClick = (tab: Tab) => {
        setActiveTab(tab);
        if (tab === "leaderboard") setLeaderboardTouched(true);
    };

    return (
        <div className="flex h-screen overflow-hidden bg-(--bg) text-(--t1)">
        <div className={`fixed inset-0 flex items-center justify-center pointer-events-none z-0 ${dark ? "opacity-10" : "opacity-5"}`}>
        <img src="/logo_background1.png" alt="" className={`w-[min(800px,90vw)] blur-sm ${dark ? "invert" : ""}`} />
        </div>

        {isMobileSidebarOpen && (
            <div className="fixed inset-0 bg-black/50 z-40 lg:hidden" onClick={() => closeMobileSidebar()} />
        )}
        <div className={`fixed inset-y-0 left-0 z-50 lg:relative transition-transform duration-300 ease-in-out ${isMobileSidebarOpen && !isSidebarClosing ? "translate-x-0" : "-translate-x-full lg:translate-x-0"}`}>
        <Sidebar />
        </div>

        <main className="flex-1 flex flex-col overflow-y-auto">
        <MobileHeader
        onOpenSidebar={openMobile}
        title={tournament.name}
        icon={<Trophy size={18} className="text-blue-600" />}
        />

        <div className="p-6 max-w-3xl w-full mx-auto">
        <button
        onClick={() => router.push("/tournaments")}
        className="mb-5 flex items-center gap-2 text-sm font-bold text-(--t2) hover:text-blue-600 transition-colors"
        >
        <ArrowLeft size={16} /> Назад до турнірів
        </button>

        {tournament.banner_url && (
            <div className="mb-5 rounded-2xl overflow-hidden border border-(--brd)">
            <img src={tournament.banner_url} alt={tournament.name} className="w-full max-h-72 object-cover" />
            </div>
        )}

        <div className="flex items-start justify-between gap-3 mb-4">
        <h1 className="text-2xl font-black text-(--t1)">{tournament.name}</h1>
        {isAdmin && (
            <button
            onClick={() => router.push(`/tournaments/${id}/edit`)}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl border border-(--brd) text-(--t2) hover:text-blue-600 hover:border-blue-600/40 text-xs font-bold transition-all"
            >
            <Edit size={14} /> Редагувати
            </button>
        )}
        </div>

        {/* ── Таби ── */}
        <div className="flex gap-1 mb-6 p-1 bg-(--card) border border-(--brd) rounded-2xl">
            {tabs.map((tab) => (
                <button
                    key={tab.key}
                    onClick={() => handleTabClick(tab.key)}
                    className={`flex-1 flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl text-sm font-black transition-all ${
                        activeTab === tab.key
                            ? "bg-blue-600 text-white shadow"
                            : "text-(--t2) hover:text-(--t1) hover:bg-(--bg)"
                    }`}
                >
                    {tab.icon}
                    {tab.label}
                </button>
            ))}
        </div>

        {/* ── Вкладка: Огляд ── */}
        {activeTab === "info" && (
            <>
            {tournament.rules && (
                <div className="mb-5 bg-(--card) border border-(--brd) rounded-2xl p-4">
                <MarkdownRenderer content={tournament.rules} />
                </div>
            )}

            {/* Stats */}
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 mb-6">
            <div className="bg-(--card) border border-(--brd) rounded-2xl p-4">
            <div className="text-[10px] font-black uppercase tracking-widest text-(--t2) mb-1">Команди</div>
            <div className="text-xl font-black text-(--t1) flex items-end gap-1">
            {teamCount}
            {tournament.max_teams && <span className="text-sm font-bold text-(--t2)">/ {tournament.max_teams}</span>}
            </div>
            </div>
            {tournament.rounds && (
                <div className="bg-(--card) border border-(--brd) rounded-2xl p-4">
                <div className="text-[10px] font-black uppercase tracking-widest text-(--t2) mb-1">Раунди</div>
                <div className="text-xl font-black text-(--t1)">{tournament.rounds}</div>
                </div>
            )}
            {tournament.start_at && (
                <div className="bg-(--card) border border-(--brd) rounded-2xl p-4 col-span-2 sm:col-span-1">
                <div className="text-[10px] font-black uppercase tracking-widest text-(--t2) mb-1">Старт</div>
                <div className="text-sm font-black text-(--t1)">{fmtDate(tournament.start_at)}</div>
                </div>
            )}
            </div>

            {/* Registration window */}
            {(tournament.registration_from || tournament.registration_to) && (
                <div className="bg-(--card) border border-(--brd) rounded-2xl p-4 mb-6 flex gap-6 flex-wrap">
                {tournament.registration_from && (
                    <div>
                    <div className="text-[10px] font-black uppercase tracking-widest text-(--t2) mb-0.5">Реєстрація від</div>
                    <div className="text-sm font-bold text-(--t1)">{fmtDate(tournament.registration_from)}</div>
                    </div>
                )}
                {tournament.registration_to && (
                    <div>
                    <div className="text-[10px] font-black uppercase tracking-widest text-(--t2) mb-0.5">Реєстрація до</div>
                    <div className="text-sm font-bold text-(--t1)">{fmtDate(tournament.registration_to)}</div>
                    </div>
                )}
                </div>
            )}

            {/* Team picker modal */}
            {teamPickerOpen && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
                <div className="bg-(--card) border border-(--brd) rounded-3xl shadow-2xl p-6 w-full max-w-sm">
                <h3 className="text-sm font-black uppercase tracking-widest text-(--t1) mb-1">Оберіть команду</h3>
                <p className="text-xs text-(--t2) mb-4">У вас кілька команд без турніру. Оберіть, яку зареєструвати:</p>
                <div className="flex flex-col gap-2 mb-4">
                {eligibleTeams.map(t => (
                    <button
                    key={t.id}
                    onClick={() => doRegister(t.id)}
                    className="w-full text-left px-4 py-3 rounded-2xl border border-(--brd) bg-(--bg) hover:border-blue-500 hover:bg-blue-500/5 text-sm font-bold text-(--t1) transition-all"
                    >
                    {t.name}
                    </button>
                ))}
                </div>
                <button
                onClick={() => setTeamPickerOpen(false)}
                className="w-full px-4 py-2 rounded-2xl border border-(--brd) text-xs font-black uppercase text-(--t2) hover:bg-(--bg) transition-all"
                >
                Скасувати
                </button>
                </div>
                </div>
            )}

            {/* Error */}
            {registerError && (
                <div className="mb-4 px-4 py-3 bg-red-500/10 border border-red-500/30 rounded-2xl text-red-500 text-sm font-bold">
                ⚠️ {registerError}
                </div>
            )}

            {/* Register button / login prompt */}
            {isRegistrationOpen && !myTeamInTournament && (
                user ? (
                <button
                onClick={handleRegister}
                disabled={registering || isFull}
                className="w-full mb-6 px-6 py-3 bg-blue-600 text-white rounded-2xl font-black text-sm uppercase tracking-wide disabled:opacity-50 hover:bg-blue-700 active:scale-[0.98] transition-all"
                >
                {isFull ? "Турнір заповнений" : registering ? "Реєстрація..." : "Зареєструвати мою команду"}
                </button>
                ) : (
                <div className="w-full mb-6 px-5 py-4 bg-(--card) border border-(--brd) rounded-2xl flex flex-col sm:flex-row items-start sm:items-center gap-3">
                    <Lock size={18} className="text-(--t2) flex-shrink-0 mt-0.5 sm:mt-0" />
                    <p className="text-sm text-(--t2) flex-1">
                        Щоб взяти участь у турнірі, необхідно{" "}
                        <button onClick={() => router.push("/login")} className="text-blue-600 font-black hover:underline">увійти до акаунту</button>
                        {" "}або{" "}
                        <button onClick={() => router.push("/register")} className="text-blue-600 font-black hover:underline">зареєструватися</button>
                    </p>
                </div>
                )
            )}

            {myTeamInTournament && (
                <div className="mb-6 flex flex-col sm:flex-row items-start sm:items-center gap-3">
                <div className="flex-1 px-4 py-3 bg-green-500/10 border border-green-500/30 rounded-2xl text-green-600 text-sm font-black">
                ✓ Ваша команда «{myTeamInTournament.name}» вже зареєстрована
                </div>
                {isRegistrationOpen && (
                    <button
                    onClick={handleUnregister}
                    disabled={unregistering}
                    className="flex-shrink-0 px-4 py-3 rounded-2xl border border-red-500/30 text-red-500 bg-red-500/10 hover:bg-red-500/20 hover:border-red-500/50 font-black text-xs uppercase tracking-wide disabled:opacity-50 active:scale-[0.98] transition-all"
                    >
                    {unregistering ? "Скасування..." : "Скасувати реєстрацію"}
                    </button>
                )}
                </div>
            )}

            {/* Rounds section */}
            {rounds.length > 0 && (
                <div className="mt-6">
                <h2 className="font-black text-lg mb-3 text-(--t1) flex items-center gap-2">
                <Flag size={18} className="text-blue-600" />
                Раунди
                </h2>
                <div className="grid gap-2">
                {rounds.map((round) => {
                    const now = Date.now();
                    const start = round.start_at ? new Date(round.start_at).getTime() : null;
                    const end = round.end_at ? new Date(round.end_at).getTime() : null;

                    const dbStatus = round.status;
                    const isFinished = dbStatus === "finished" || (!dbStatus && end && now > end);
                    const isActive   = dbStatus === "active"   || (!dbStatus && start && end && now >= start && now <= end);
                    const isPending  = dbStatus === "pending"  || (!dbStatus && start && now < start);

                    let statusLabel = "Очікується";
                    let statusColor = "text-(--t2)";
                    let statusBadgeBg = "bg-(--bg)";
                    let statusBadgeBorder = "border-(--brd)";
                    let dotColor    = "bg-gray-400";

                    if (isFinished) {
                        statusLabel = "Завершено";
                    } else if (isActive) {
                        statusLabel        = "Активний";
                        statusColor        = "text-green-600";
                        statusBadgeBg      = "bg-green-600/15";
                        statusBadgeBorder  = "border-green-600/50";
                        dotColor           = "bg-green-600";
                    } else if (isPending) {
                        statusLabel = "Очікується";
                    }

                    const isLocked = isFinished;
                    const isRegistered = !!myTeamInTournament;

                    return (
                        <div
                        key={round.id}
                        onClick={() => router.push(`/rounds/${round.id}`)}
                        className={`flex items-center gap-4 p-4 border rounded-2xl cursor-pointer transition-all group bg-(--card) hover:bg-(--card) ${
                            isActive
                            ? 'border-green-600/50 hover:border-green-600/70'
                            : isRegistered
                            ? 'border-green-600/30 hover:border-green-600/50'
                            : 'border-(--brd) hover:border-blue-600/40'
                        }`}
                        >
                        <div className={`w-10 h-10 rounded-xl flex items-center justify-center text-sm font-black flex-shrink-0 transition-all ${
                            isLocked
                            ? "bg-(--bg) border border-(--brd) text-(--t2)"
                            : "bg-blue-600/10 text-blue-600 group-hover:bg-blue-600 group-hover:text-white"
                        }`}>
                        {isLocked ? <Lock size={14} /> : round.number}
                        </div>
                        <div className="flex-1 min-w-0">
                        <p className="font-black text-sm text-(--t1) group-hover:text-blue-600 transition-colors truncate">
                        {round.name || `Раунд ${round.number}`}
                        </p>
                        {(round.start_at || round.end_at) && (
                            <p className="text-[11px] text-(--t2) font-medium mt-0.5 flex items-center gap-1">
                            <Clock size={10} />
                            {round.start_at && fmtDate(round.start_at)}
                            {round.start_at && round.end_at && " — "}
                            {round.end_at && fmtDate(round.end_at)}
                            </p>
                        )}
                        </div>
                        <div className={`flex items-center gap-1.5 px-3 py-1 rounded-full border text-[10px] font-black uppercase tracking-wider flex-shrink-0 ${statusBadgeBg} ${statusBadgeBorder} ${statusColor}`}>
                        <span className={`w-1.5 h-1.5 rounded-full ${dotColor} ${isActive ? 'animate-pulse' : ''}`} />
                        {statusLabel}
                        </div>
                        <ChevronRight size={16} className="text-(--t2) group-hover:text-blue-600 transition-colors flex-shrink-0" />
                        </div>
                    );
                })}
                </div>
                </div>
            )}

            {/* Teams list */}
            <div className="mt-6">
            <h2 className="font-black text-lg mb-3 text-(--t1)">Команди-учасники</h2>
            {teamCount === 0 ? (
                <div className="text-center py-10 text-(--t2)">
                <Users size={32} className="mx-auto mb-2 opacity-30" />
                <p className="text-sm font-bold">Поки немає зареєстрованих команд</p>
                </div>
            ) : (
                <div className="grid gap-2">
                {tournament.teams.map((team, idx) => (
                    <div
                    key={team.id}
                    onClick={() => router.push(`/teams/${team.id}`)}
                    className="flex items-center gap-3 p-4 border border-(--brd) rounded-2xl bg-(--card) hover:border-blue-600/40 cursor-pointer transition-all group"
                    >
                    <div className="w-8 h-8 rounded-xl overflow-hidden flex-shrink-0">
                    {team.avatar_url
                        ? <img src={team.avatar_url} alt={team.name} className="w-full h-full object-cover" />
                        : <div className="w-full h-full bg-blue-600/10 text-blue-600 flex items-center justify-center text-xs font-black">{idx + 1}</div>
                    }
                    </div>
                    <div className="flex-1 min-w-0">
                    <p className="font-black text-sm text-(--t1) group-hover:text-blue-600 transition-colors truncate">{team.name}</p>
                    {team.city_school_org && (
                        <p className="text-[11px] text-(--t2) font-bold truncate">{team.city_school_org}</p>
                    )}
                    </div>
                    </div>
                ))}
                </div>
            )}
            </div>

            {/* Jury list */}
            {jury.length > 0 && (
                <div className="mt-6">
                <h2 className="font-black text-lg mb-3 text-(--t1) flex items-center gap-2">
                <Star size={18} className="text-amber-500" />
                Журі
                </h2>
                <div className="grid gap-2">
                {jury.map((member) => (
                    <div
                    key={member.jury_id}
                    onClick={() => router.push(`/user/${member.jury_id}`)}
                    className="flex items-center gap-3 p-4 border border-(--brd) rounded-2xl bg-(--card) hover:border-amber-500/40 cursor-pointer transition-all group"
                    >
                    <div className="w-8 h-8 rounded-full overflow-hidden flex-shrink-0 bg-amber-500/10 border border-amber-500/20 flex items-center justify-center">
                    {member.avatar_url
                        ? <img src={member.avatar_url} alt={member.username} className="w-full h-full object-cover" />
                        : <Star size={14} className="text-amber-500" />
                    }
                    </div>
                    <div className="flex-1 min-w-0">
                    <p className="font-black text-sm text-(--t1) group-hover:text-amber-500 transition-colors truncate">{member.username}</p>
                    <p className="text-[10px] font-bold text-(--t2) uppercase tracking-widest">Суддя</p>
                    </div>
                    </div>
                ))}
                </div>
                </div>
            )}
            </>
        )}

        {/* ── Вкладка: Лідербоард ── */}
        {activeTab === "leaderboard" && leaderboardTouched && (
            <LeaderboardSection tournamentId={id} />
        )}

        </div>
        </main>
        </div>
    );
}