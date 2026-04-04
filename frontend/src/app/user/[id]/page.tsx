"use client";

import React, { useState, useEffect } from "react";
import { useRouter, useParams } from "next/navigation";
import { User, Mail, Shield, ChevronRight, UserCircle, ArrowLeft, Loader } from "lucide-react";
import { useTheme } from "@/hooks/useTheme";
import { useAuth } from "@/context/AuthContext";
import { useT } from "@/context/LanguageContext";
import { supabase } from "@/lib/supabase";
import Sidebar from "@/components/Sidebar";
import MobileHeader from "@/components/MobileHeader";

const API_URL =
  typeof window !== "undefined" && window.location.hostname === "localhost"
    ? "http://localhost:8000"
    : "https://site-turing-crutchmasters-team-s.onrender.com";

const ROLES = ["user", "jury", "admin"] as const;
type Role = typeof ROLES[number];

const roleBadge: Record<Role, string> = {
  user:       "bg-gray-500/10 text-gray-500 border-gray-500/20",
  jury:       "bg-purple-500/10 text-purple-500 border-purple-500/20",
  admin:      "bg-orange-500/10 text-orange-500 border-orange-500/20",
  superadmin: "bg-red-500/10 text-red-500 border-red-500/20",
};

export default function PublicUserProfile() {
  const [isMobileSidebarOpen, setIsMobileSidebarOpen] = useState(false);
  const { dark } = useTheme();
  const router = useRouter();
  const params = useParams();
  const { user: currentUser, token, isLoading: authLoading } = useAuth();
  const { t } = useT();

  const [profileUser, setProfileUser] = useState<any>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedRole, setSelectedRole] = useState<Role>("user");
  const [isChangingRole, setIsChangingRole] = useState(false);
  const [roleMsg, setRoleMsg] = useState<{ type: "ok" | "err"; text: string } | null>(null);

  const isSuperAdmin = currentUser?.role === "superadmin";
  const isOwnProfile = currentUser?.id === params.id;

  useEffect(() => {
    if (authLoading) return;
    if (!currentUser) { router.push("/login"); return; }
    (async () => {
      setIsLoading(true);
      try {
        const { data, error } = await supabase
          .from("account")
          .select("id, username, login, email, role, status, avatar_url")
          .eq("id", params.id)
          .single();
        if (error) throw error;
        setProfileUser(data);
        setSelectedRole((data.role as Role) ?? "user");
      } catch {
        setError(t.userProfile.notFound);
      } finally {
        setIsLoading(false);
      }
    })();
  }, [params.id, authLoading, currentUser]);

  const handleRoleChange = async () => {
    if (!isSuperAdmin || !profileUser) return;
    setIsChangingRole(true); setRoleMsg(null);
    try {
      const res = await fetch(`${API_URL}/api/change-role`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({ target_user_id: profileUser.id, new_role: selectedRole }),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.detail ?? t.common.error);
      setProfileUser((prev: any) => ({ ...prev, role: selectedRole }));
      setRoleMsg({ type: "ok", text: `${t.userProfile.roleChanged} «${selectedRole}»` });
    } catch (e: any) {
      setRoleMsg({ type: "err", text: e.message });
    } finally {
      setIsChangingRole(false);
    }
  };

  if (authLoading || isLoading) return (
    <div className="min-h-screen bg-(--bg) flex items-center justify-center">
      <div className="w-8 h-8 border-2 border-blue-600 border-t-transparent rounded-full animate-spin" />
    </div>
  );

  return (
    <div className="flex h-screen overflow-hidden bg-(--bg) text-(--t1) transition-colors duration-300">
      <div className={`fixed inset-0 flex items-center justify-center pointer-events-none z-0 ${dark ? "opacity-10" : "opacity-5"}`}>
        <img src="/logo_background1.png" alt="" className={`w-[min(800px,90vw)] h-[min(800px,90vw)] object-contain blur-sm ${dark ? "invert" : ""}`} />
      </div>
      {isMobileSidebarOpen && <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-40 lg:hidden" onClick={() => setIsMobileSidebarOpen(false)} />}
      <div className={`fixed inset-y-0 left-0 z-50 lg:relative lg:translate-x-0 transition-transform duration-300 ease-in-out ${isMobileSidebarOpen ? "translate-x-0" : "-translate-x-full lg:translate-x-0"}`}>
        <Sidebar />
      </div>

      <main className="flex-1 flex flex-col min-w-0 overflow-hidden">
        <MobileHeader onOpenSidebar={() => setIsMobileSidebarOpen(true)} title={t.userProfile.title} icon={<UserCircle size={18} className="text-blue-600" />} />

        <div className="flex-1 overflow-y-auto p-4 sm:p-6 md:p-8 lg:p-12 relative z-10">
          <nav className="flex items-center gap-2 text-[10px] font-black mb-6 uppercase tracking-widest text-(--t2)">
            <button onClick={() => router.push("/")} className="hover:text-blue-600">{t.nav.home}</button>
            <ChevronRight size={10} />
            <button onClick={() => router.back()} className="hover:text-blue-600">{t.search.title}</button>
            <ChevronRight size={10} />
            <span className="text-(--t1)">{t.userProfile.title}</span>
          </nav>

          <button onClick={() => router.back()} className="mb-6 flex items-center gap-2 text-[11px] font-black uppercase tracking-widest text-(--t2) hover:text-blue-600 transition-colors">
            <ArrowLeft size={14} /> {t.userProfile.back}
          </button>

          {error ? (
            <div className="bg-(--card) rounded-2xl sm:rounded-[2.5rem] border border-(--brd) p-12 text-center">
              <p className="text-lg font-black text-(--t1) mb-2">{error}</p>
              <p className="text-(--t2) text-sm">{t.userProfile.notFoundHint}</p>
            </div>
          ) : profileUser && (
            <div className="max-w-2xl space-y-6">
              <section className="bg-(--card) rounded-2xl sm:rounded-[2.5rem] shadow-sm border border-(--brd) p-6 sm:p-8 relative overflow-hidden">
                <div className="absolute right-0 top-0 opacity-5 pointer-events-none text-(--t1) hidden md:block"><Shield size={240} /></div>
                <div className="flex flex-col sm:flex-row items-center gap-6 sm:gap-8">
                  <div className="relative flex-shrink-0">
                    <div className="w-24 h-24 sm:w-28 sm:h-28 rounded-full bg-blue-600/10 flex items-center justify-center border-4 border-(--brd) shadow-md">
                      <span className="text-4xl font-black text-blue-600">{profileUser.username?.charAt(0).toUpperCase() ?? "?"}</span>
                    </div>
                    {profileUser.status === "active" && <span className="absolute bottom-1 right-1 w-5 h-5 bg-green-500 border-4 border-(--card) rounded-full shadow-sm" />}
                  </div>
                  <div className="flex-1 space-y-3 z-10 w-full text-center sm:text-left">
                    <h1 className="text-2xl font-black text-(--t1) uppercase tracking-tight">{profileUser.username}</h1>
                    {isOwnProfile && <span className="inline-block text-[9px] font-black uppercase bg-blue-500/10 text-blue-500 border border-blue-500/20 px-2.5 py-1 rounded-lg">{t.userProfile.ownProfile}</span>}
                    <div className="mt-4 space-y-2.5 text-sm text-left">
                      <p className="flex items-center gap-3 font-medium"><User size={16} className="text-blue-600 flex-shrink-0" /><span className="text-(--t2)">{t.userProfile.nameLabel}:</span><span className="font-bold">{profileUser.username}</span></p>
                      <p className="flex items-center gap-3 font-medium"><User size={16} className="text-blue-600 flex-shrink-0" /><span className="text-(--t2)">{t.userProfile.loginLabel}:</span><span className="font-bold">{profileUser.login}</span></p>
                      <p className="flex items-center gap-3 font-medium"><Mail size={16} className="text-blue-600 flex-shrink-0" /><span className="text-(--t2)">{t.userProfile.emailLabel}:</span><span className="font-bold break-all">{profileUser.email}</span></p>
                      <p className="flex items-center gap-3 font-medium"><Shield size={16} className="text-blue-600 flex-shrink-0" /><span className="text-(--t2)">{t.userProfile.roleLabel}:</span>
                        <span className={`text-[10px] font-black uppercase px-2.5 py-1 rounded-lg border ${roleBadge[profileUser.role as Role] ?? roleBadge.user}`}>{profileUser.role ?? "user"}</span>
                      </p>
                    </div>
                    <div className="pt-3 border-t border-(--brd) text-[9px] font-bold uppercase tracking-widest text-(--t2)">{t.userProfile.idLabel}: {profileUser.id}</div>
                  </div>
                </div>
              </section>

              {isSuperAdmin && !isOwnProfile && (
                <section className="bg-(--card) rounded-2xl sm:rounded-[2.5rem] shadow-sm border border-red-500/30 p-6 sm:p-8">
                  <h2 className="text-sm font-black mb-1 uppercase tracking-widest text-red-500 flex items-center gap-2"><Shield size={16} /> {t.userProfile.manageRole}</h2>
                  <p className="text-[10px] text-(--t2) font-bold uppercase tracking-wider mb-5">{t.userProfile.manageRoleHint}</p>
                  <div className="flex flex-wrap gap-2 mb-4">
                    {ROLES.map(role => (
                      <button key={role} onClick={() => setSelectedRole(role)}
                        className={`px-4 py-2 rounded-xl font-black text-[10px] uppercase tracking-widest border transition-all ${selectedRole === role ? roleBadge[role] + " border-current scale-105" : "bg-(--bg) text-(--t2) border-(--brd) hover:border-blue-600/40"}`}>
                        {role}
                      </button>
                    ))}
                  </div>
                  <button onClick={handleRoleChange} disabled={isChangingRole || selectedRole === profileUser.role}
                    className={`px-6 py-3 rounded-2xl font-black text-xs uppercase tracking-widest transition-all active:scale-95 flex items-center gap-2 ${isChangingRole || selectedRole === profileUser.role ? "bg-(--brd) text-(--t2) cursor-not-allowed" : "bg-red-600 text-white hover:bg-red-700 shadow-lg shadow-red-600/20"}`}>
                    {isChangingRole ? <Loader size={14} className="animate-spin" /> : <Shield size={14} />}
                    {isChangingRole ? t.userProfile.changingRole : t.userProfile.changeRole}
                  </button>
                  {roleMsg && <p className={`mt-3 text-[10px] font-black uppercase tracking-widest ${roleMsg.type === "ok" ? "text-green-500" : "text-red-500"}`}>{roleMsg.text}</p>}
                </section>
              )}
            </div>
          )}
        </div>
      </main>
    </div>
  );
}
