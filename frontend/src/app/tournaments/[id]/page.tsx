"use client";

import React, { useEffect, useState } from "react";
import { useRouter, useParams } from "next/navigation";
import { supabase } from "@/lib/supabase";
import { useAuth } from "@/context/AuthContext";
import { useTheme } from "@/hooks/useTheme";
import Sidebar from "@/components/Sidebar";
import MobileHeader from "@/components/MobileHeader";
import { Trophy, Users, ArrowLeft, Loader, Edit } from "lucide-react";

interface Team {
    id: string;
    name: string;
    city_school_org?: string;
    captain_id?: string;
}

interface MyTeam {
    id: string;
    name: string;
    captain_id: string;
    tournament_id: string | null;
}

interface Tournament {
    id: string;
    name: string;
    rules?: string;
    max_teams?: number;
    rounds?: number;
    status: string;
    start_at?: string;
    registration_from?: string;
    registration_to?: string;
    teams: Team[];
}

function fmtDate(iso?: string) {
    if (!iso) return "—";
    return new Date(iso).toLocaleDateString("uk-UA", {
        day: "numeric",
        month: "long",
        year: "numeric",
        hour: "2-digit",
        minute: "2-digit",
    });
}

// Человекочитаемые статусы турнира
const STATUS_LABELS: Record<string, { label: string; color: string }> = {
    draft:        { label: "Чернетка",      color: "text-gray-500 bg-gray-500/10 border-gray-500/20" },
    registration: { label: "Реєстрація",    color: "text-blue-600 bg-blue-600/10 border-blue-600/20" },
    ongoing:      { label: "Триває",        color: "text-green-600 bg-green-500/10 border-green-500/20" },
    finished:     { label: "Завершено",     color: "text-purple-600 bg-purple-500/10 border-purple-500/20" },
    cancelled:    { label: "Скасовано",     color: "text-red-500 bg-red-500/10 border-red-500/20" },
};

export default function TournamentPage() {
    const router = useRouter();
    const params = useParams();
    const { user } = useAuth();
    const { dark } = useTheme();

    const id = params?.id as string;

    const [tournament, setTournament] = useState<Tournament | null>(null);
    const [myTeam, setMyTeam] = useState<MyTeam | null | undefined>(undefined); // undefined = ещё не загружено
    const [loading, setLoading] = useState(true);
    const [registering, setRegistering] = useState(false);
    const [isMobileSidebarOpen, setIsMobileSidebarOpen] = useState(false);

    useEffect(() => {
        if (!id) return;
        fetchTournament();
        if (user) fetchMyTeam();
    }, [id, user]);

        const fetchTournament = async () => {
            setLoading(true);
            try {
                const { data, error } = await supabase
                .from("tournaments")
                .select(`
                *,
                teams!tournament_id(id, name, city_school_org, captain_id)
                `)
                .eq("id", id)
                .single();

                if (error) throw error;
                setTournament(data as Tournament);
            } catch (e) {
                console.error(e);
            } finally {
                setLoading(false);
            }
        };

        // Загружаем команду текущего юзера (если он капитан) — отдельным запросом,
        // независимо от того, в каком турнире команда сейчас зарегистрирована.
        const fetchMyTeam = async () => {
            if (!user) return;
            const { data, error } = await supabase
            .from("teams")
            .select("id, name, captain_id, tournament_id")
            .eq("captain_id", user.id)
            .maybeSingle();

            if (error) {
                console.error(error);
                setMyTeam(null);
                return;
            }
            setMyTeam(data as MyTeam | null);
        };

        const handleRegister = async () => {
            if (!user || !myTeam) return;

            setRegistering(true);
            const { error } = await supabase
            .from("teams")
            .update({ tournament_id: id })
            .eq("id", myTeam.id);
            setRegistering(false);

            if (error) {
                console.error(error);
                alert("Помилка реєстрації");
                return;
            }

            // Обновляем локальное состояние без перезагрузки
            setMyTeam(prev => prev ? { ...prev, tournament_id: id } : prev);
            fetchTournament();
        };

        const handleUnregister = async () => {
            if (!user || !myTeam) return;
            if (!confirm("Скасувати реєстрацію команди?")) return;

            setRegistering(true);
            const { error } = await supabase
            .from("teams")
            .update({ tournament_id: null })
            .eq("id", myTeam.id);
            setRegistering(false);

            if (error) {
                console.error(error);
                alert("Помилка скасування");
                return;
            }

            setMyTeam(prev => prev ? { ...prev, tournament_id: null } : prev);
            fetchTournament();
        };

        if (loading || !tournament) {
            return (
                <div className="min-h-screen bg-(--bg) flex items-center justify-center">
                <Loader className="animate-spin text-blue-600" />
                </div>
            );
        }

        const teamCount = tournament.teams?.length ?? 0;
        const isFull = tournament.max_teams !== undefined && teamCount >= tournament.max_teams;
        const isAdmin = user?.role === "admin" || user?.role === "superadmin";

        // Зарегистрирована ли моя команда именно в этом турнире
        const isMyTeamInThisTournament = myTeam?.tournament_id === id;
        // Зарегистрирована ли моя команда в другом турнире
        const isMyTeamInOtherTournament = myTeam?.tournament_id && myTeam.tournament_id !== id;

        const statusInfo = STATUS_LABELS[tournament.status] ?? {
            label: tournament.status,
            color: "text-gray-500 bg-gray-500/10 border-gray-500/20",
        };

        // Определяем что показать в блоке регистрации
        const renderRegistrationBlock = () => {
            // Юзер не залогинен
            if (!user) return null;

            // Данные ещё загружаются
            if (myTeam === undefined) return null;

            // Юзер залогинен, но не капитан ни одной команды
            if (myTeam === null) {
                return (
                    <div className="mb-6 px-4 py-3 bg-(--card) border border-(--brd) rounded-2xl text-(--t2) text-sm font-bold">
                    Щоб зареєструватись, спочатку{" "}
                    <button
                    onClick={() => router.push("/teams/create")}
                    className="text-blue-600 hover:underline font-black"
                    >
                    створіть команду
                    </button>{" "}
                    та станьте капітаном.
                    </div>
                );
            }

            // Команда уже в этом турнире
            if (isMyTeamInThisTournament) {
                return (
                    <div className="mb-6 flex items-center justify-between gap-3 px-4 py-3 bg-green-500/10 border border-green-500/30 rounded-2xl">
                    <span className="text-green-600 text-sm font-black">
                    ✓ Ваша команда «{myTeam.name}» зареєстрована
                    </span>
                    {tournament.status === "registration" && (
                        <button
                        onClick={handleUnregister}
                        disabled={registering}
                        className="text-xs font-bold text-red-500 hover:text-red-600 disabled:opacity-50 transition-colors flex-shrink-0"
                        >
                        {registering ? "..." : "Скасувати"}
                        </button>
                    )}
                    </div>
                );
            }

            // Команда в другом турнире
            if (isMyTeamInOtherTournament) {
                return (
                    <div className="mb-6 px-4 py-3 bg-yellow-500/10 border border-yellow-500/30 rounded-2xl text-yellow-600 text-sm font-bold">
                    ⚠️ Ваша команда «{myTeam.name}» вже зареєстрована в іншому турнірі.
                    </div>
                );
            }

            // Турнир не в статусе регистрации
            if (tournament.status !== "registration") {
                const messages: Record<string, string> = {
                    draft:     "Реєстрація ще не відкрита",
                    ongoing:   "Турнір вже розпочався",
                    finished:  "Турнір завершено",
                    cancelled: "Турнір скасовано",
                };
                return (
                    <div className="mb-6 px-4 py-3 bg-(--card) border border-(--brd) rounded-2xl text-(--t2) text-sm font-bold">
                    {messages[tournament.status] ?? "Реєстрація недоступна"}
                    </div>
                );
            }

            // Турнир заполнен
            if (isFull) {
                return (
                    <div className="mb-6 px-4 py-3 bg-red-500/10 border border-red-500/30 rounded-2xl text-red-500 text-sm font-bold">
                    Турнір заповнений — місць немає
                    </div>
                );
            }

            // Всё ок — показываем кнопку регистрации
            return (
                <button
                onClick={handleRegister}
                disabled={registering}
                className="w-full mb-6 px-6 py-3 bg-blue-600 text-white rounded-2xl font-black text-sm uppercase tracking-wide disabled:opacity-50 hover:bg-blue-700 active:scale-[0.98] transition-all"
                >
                {registering ? "Реєстрація..." : `Зареєструвати команду «${myTeam.name}»`}
                </button>
            );
        };

        return (
            <div className="flex h-screen overflow-hidden bg-(--bg) text-(--t1)">

            {/* Background */}
            <div className={`fixed inset-0 flex items-center justify-center pointer-events-none z-0 ${dark ? "opacity-10" : "opacity-5"}`}>
            <img src="/logo_background1.png" alt="" className={`w-[min(800px,90vw)] blur-sm ${dark ? "invert" : ""}`} />
            </div>

            {/* Sidebar overlay (mobile) */}
            {isMobileSidebarOpen && (
                <div className="fixed inset-0 bg-black/50 z-40 lg:hidden" onClick={() => setIsMobileSidebarOpen(false)} />
            )}

            <div className={`fixed inset-y-0 left-0 z-50 lg:relative transition-transform ${isMobileSidebarOpen ? "translate-x-0" : "-translate-x-full lg:translate-x-0"}`}>
            <Sidebar />
            </div>

            <main className="flex-1 flex flex-col overflow-y-auto">
            <MobileHeader
            onOpenSidebar={() => setIsMobileSidebarOpen(true)}
            title={tournament.name}
            icon={<Trophy size={18} className="text-blue-600" />}
            />

            <div className="p-6 max-w-3xl w-full mx-auto">

            {/* Back */}
            <button
            onClick={() => router.push("/tournaments")}
            className="mb-5 flex items-center gap-2 text-sm font-bold text-(--t2) hover:text-blue-600 transition-colors"
            >
            <ArrowLeft size={16} /> Назад до турнірів
            </button>

            {/* Title row */}
            <div className="flex items-start justify-between gap-3 mb-3">
            <h1 className="text-2xl font-black text-(--t1)">{tournament.name}</h1>
            {isAdmin && (
                <button
                onClick={() => router.push(`/tournaments/${id}/edit`)}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl border border-(--brd) text-(--t2) hover:text-blue-600 hover:border-blue-600/40 text-xs font-bold transition-all flex-shrink-0"
                >
                <Edit size={14} /> Редагувати
                </button>
            )}
            </div>

            {/* Status badge */}
            <div className="mb-5">
            <span className={`inline-flex items-center px-3 py-1 rounded-full text-xs font-black border ${statusInfo.color}`}>
            {statusInfo.label}
            </span>
            </div>

            {/* Rules */}
            {tournament.rules && (
                <p className="text-sm text-(--t2) leading-relaxed mb-5 bg-(--card) border border-(--brd) rounded-2xl p-4">
                {tournament.rules}
                </p>
            )}

            {/* Stats cards */}
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 mb-6">
            <div className="bg-(--card) border border-(--brd) rounded-2xl p-4">
            <div className="text-[10px] font-black uppercase tracking-widest text-(--t2) mb-1">Команди</div>
            <div className="text-xl font-black text-(--t1) flex items-end gap-1">
            {teamCount}
            {tournament.max_teams && (
                <span className="text-sm font-bold text-(--t2)">/ {tournament.max_teams}</span>
            )}
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

            {/* Registration block — always rendered, content depends on state */}
            {renderRegistrationBlock()}

            {/* Teams list */}
            <div>
            <h2 className="font-black text-lg mb-3 text-(--t1)">
            Команди-учасники
            </h2>

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
                    <div className="w-8 h-8 rounded-xl bg-blue-600/10 text-blue-600 flex items-center justify-center text-xs font-black flex-shrink-0">
                    {idx + 1}
                    </div>
                    <div className="flex-1 min-w-0">
                    <p className="font-black text-sm text-(--t1) group-hover:text-blue-600 transition-colors truncate">
                    {team.name}
                    </p>
                    {team.city_school_org && (
                        <p className="text-[11px] text-(--t2) font-bold truncate">{team.city_school_org}</p>
                    )}
                    </div>
                    {/* Highlight my team */}
                    {team.captain_id === user?.id && (
                        <span className="text-[10px] font-black text-blue-600 bg-blue-600/10 px-2 py-0.5 rounded-full flex-shrink-0">
                        Моя
                        </span>
                    )}
                    </div>
                ))}
                </div>
            )}
            </div>
            </div>
            </main>
            </div>
        );
}
