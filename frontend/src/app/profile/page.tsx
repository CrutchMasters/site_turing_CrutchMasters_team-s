"use client";

import React, { useState, useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import {
  User, Mail, Shield, LogOut, Camera, Edit2, CheckCircle, AlertCircle, Loader,
} from "lucide-react";
import { useTheme } from "@/hooks/useTheme";
import { useAuth } from "@/context/AuthContext";
import { useT } from "@/context/LanguageContext";
import Sidebar from "@/components/Sidebar";
import MobileHeader from "@/components/MobileHeader";

const API_URL =
typeof window !== "undefined" && window.location.hostname === "localhost"
? "http://localhost:8000"
: "https://site-turing-crutchmasters-team-s.onrender.com";

const roleBadgeColor: Record<string, string> = {
  user: "bg-gray-500/10 text-gray-500 border-gray-500/20",
  jury: "bg-purple-500/10 text-purple-500 border-purple-500/20",
  admin: "bg-orange-500/10 text-orange-500 border-orange-500/20",
  superadmin: "bg-red-500/10 text-red-500 border-red-500/20",
};

export default function ProfilePage() {
  const [isMobileSidebarOpen, setIsMobileSidebarOpen] = useState(false);
  const { dark } = useTheme();
  const router = useRouter();
  const { user, isLoading } = useAuth();
  const { t } = useT();

  useEffect(() => {
    if (authLoading) return;

    if (!currentUser) {
      router.push("/login");
      return;
    }

    // Load user data
    setUsername(currentUser.username || "");
    setEmail(currentUser.email || "");
    setIsLoading(false);
  }, [authLoading, currentUser, router]);

  const handleSaveProfile = async () => {
    if (!currentUser || !token) return;

    setIsSaving(true);
    setError(null);
    setSuccess(null);

    try {
      // Update in Supabase
      const { error: updateError } = await supabase
      .from("account")
      .update({
        username,
        email,
      })
      .eq("id", currentUser.id);

      if (updateError) throw updateError;

      // Update localStorage
      const updatedUser = { ...currentUser, username, email };
      localStorage.setItem("user", JSON.stringify(updatedUser));

      setSuccess("Profile updated successfully");
      setIsEditing(false);
      console.log("Profile updated");
    } catch (e: any) {
      console.error("Save profile error:", e.message);
      setError(e.message || "Failed to save profile");
    } finally {
      setIsSaving(false);
    }
  };

  const handleAvatarChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !currentUser) return;

    setIsSaving(true);
    setError(null);

    try {
      console.log("Uploading avatar:", file.name);

      // Upload to Supabase Storage
      const fileName = `avatar_${currentUser.id}_${Date.now()}`;
      const { error: uploadError } = await supabase.storage
      .from("avatars")
      .upload(fileName, file, { upsert: true });

      if (uploadError) throw uploadError;

      // Get public URL
      const { data } = supabase.storage
      .from("avatars")
      .getPublicUrl(fileName);

      // Update user record
      const { error: updateError } = await supabase
      .from("account")
      .update({ avatar_url: data.publicUrl })
      .eq("id", currentUser.id);

      if (updateError) throw updateError;

      setSuccess("Avatar uploaded successfully");
      console.log("Avatar updated");
    } catch (e: any) {
      console.error("Avatar upload error:", e.message);
      setError(e.message || "Failed to upload avatar");
    } finally {
      setIsSaving(false);
    }
  };

  if (authLoading) {
    return (
      <div className="min-h-screen bg-(--bg) flex items-center justify-center">
      <div className="w-8 h-8 border-2 border-blue-600 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  if (!currentUser) {
    return null;
  }

  if (isLoading) {
    return (
      <div className="flex h-screen overflow-hidden bg-(--bg) text-(--t1)">
      <div className={`fixed inset-0 flex items-center justify-center pointer-events-none z-0 ${dark ? "opacity-10" : "opacity-5"}`}>
      <img
      src="/logo_background1.png"
      alt=""
      className={`w-[min(800px,90vw)] h-[min(800px,90vw)] object-contain blur-sm ${dark ? "invert" : ""}`}
      />
      </div>

      {isMobileSidebarOpen && (
        <div
        className="fixed inset-0 bg-black/50 backdrop-blur-sm z-40 lg:hidden"
        onClick={() => setIsMobileSidebarOpen(false)}
        />
      )}

      <div
      className={`fixed inset-y-0 left-0 z-50 lg:relative lg:translate-x-0 transition-transform duration-300 ease-in-out ${
        isMobileSidebarOpen ? "translate-x-0" : "-translate-x-full lg:translate-x-0"
      }`}
      >
      <Sidebar />
      </div>

      <main className="flex-1 flex flex-col min-w-0 overflow-hidden">
        <MobileHeader
          onOpenSidebar={() => setIsMobileSidebarOpen(true)}
          title={t.profile.title}
          icon={<UserCircle size={18} className="text-blue-600" />}
        />

        <div className="flex-1 overflow-y-auto p-4 sm:p-6 md:p-8 lg:p-12 relative z-10">
          <nav className="flex items-center gap-2 text-[10px] font-black mb-4 uppercase tracking-widest text-(--t2)">
            <button onClick={() => router.push("/")} className="hover:text-blue-600">{t.nav.home}</button>
            <ChevronRight size={10} /><span className="text-(--t1)">{t.profile.title}</span>
          </nav>

          <h1 className="text-2xl sm:text-3xl font-black text-(--t1) uppercase tracking-tight mb-6 sm:mb-8">
            {t.profile.title} — <span className="text-blue-600">{user.username}</span>
          </h1>

          <div className="max-w-6xl space-y-6">
            <section className="bg-(--card) rounded-2xl sm:rounded-[2.5rem] shadow-sm border border-(--brd) p-6 sm:p-8 flex flex-col sm:flex-row items-center gap-6 sm:gap-8 relative overflow-hidden">
              <div className="absolute right-0 top-0 opacity-5 pointer-events-none text-(--t1) hidden md:block"><Shield size={240} /></div>
              <div className="relative flex-shrink-0">
                <div className="w-24 h-24 sm:w-28 sm:h-28 rounded-full bg-blue-600/10 flex items-center justify-center border-4 border-(--brd) shadow-md">
                  <span className="text-4xl font-black text-blue-600">{avatarLetter}</span>
                </div>
                <span className="absolute bottom-1 right-1 w-5 h-5 bg-green-500 border-4 border-(--card) rounded-full shadow-sm" />
              </div>
              <div className="flex-1 space-y-4 z-10 w-full">
                <div className="flex flex-col sm:flex-row justify-between items-center sm:items-start gap-4">
                  <div className="text-center sm:text-left">
                    <h2 className="text-lg font-black flex flex-wrap justify-center sm:justify-start items-center gap-2 uppercase tracking-tight">
                      {t.profile.basicInfo}
                      <span className="text-green-600 text-[9px] font-black uppercase bg-green-500/10 px-2.5 py-1 rounded-lg border border-green-500/20">{t.profile.active}</span>
                    </h2>
                    <div className="mt-4 space-y-2.5 text-sm text-left">
                      <p className="flex items-center gap-3 font-medium"><User size={16} className="text-blue-600 flex-shrink-0" /><span className="text-(--t2)">{t.profile.nameLabel}:</span> <span className="font-bold">{user.username}</span></p>
                      <p className="flex items-center gap-3 font-medium"><User size={16} className="text-blue-600 flex-shrink-0" /><span className="text-(--t2)">{t.profile.loginLabel}:</span> <span className="font-bold">{user.login}</span></p>
                      <p className="flex items-center gap-3 font-medium"><Mail size={16} className="text-blue-600 flex-shrink-0" /><span className="text-(--t2)">{t.profile.emailLabel}:</span> <span className="font-bold break-all">{user.email}</span></p>
                      <p className="flex items-center gap-3 font-bold text-blue-600"><Shield size={16} className="flex-shrink-0" /><span>{t.profile.roleLabel}:</span> <span className="uppercase tracking-wider">{user.role}</span></p>
                    </div>
                  </div>
                  <button className="w-full sm:w-auto bg-blue-600 text-white px-6 py-3 sm:py-4 rounded-2xl font-black text-xs uppercase tracking-widest hover:bg-blue-700 transition-all flex items-center justify-center gap-2 shadow-lg shadow-blue-600/20 active:scale-95">
                    <Edit2 size={14} /> {t.profile.editBtn}
                  </button>
                </div>
                <div className="pt-3 border-t border-(--brd) text-[9px] font-bold uppercase tracking-widest text-(--t2) text-center sm:text-left">ID: {user.id}</div>
              </div>
            </section>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              <section className="bg-(--card) rounded-2xl sm:rounded-[2.5rem] shadow-sm border border-(--brd) p-6 sm:p-8">
                <h2 className="text-lg font-black mb-6 flex items-center gap-2 uppercase tracking-tight text-(--t1)"><Users className="text-blue-600" /> {t.profile.teamSection}</h2>
                <div className="space-y-3">
                  {[{ name: "Антон Петров", role: "Team Lead" }, { name: "Марія Сидоренко", role: "Frontend" }, { name: "Олег Іванов", role: "UI/UX" }].map((m, i) => (
                    <div key={i} className="flex items-center justify-between p-3 rounded-2xl bg-(--bg)/30 border border-(--brd) hover:bg-(--bg)/50 transition-colors">
                      <div className="flex items-center gap-3 overflow-hidden">
                        <div className="w-8 h-8 rounded-full bg-blue-600/10 flex items-center justify-center font-bold text-blue-600 text-xs flex-shrink-0">{m.name.charAt(0)}</div>
                        <div className="overflow-hidden"><p className="font-bold text-sm truncate">{m.name}</p><p className="text-[10px] text-(--t2) font-bold uppercase tracking-tighter">{m.role}</p></div>
                      </div>
                      <button className="text-blue-600 font-black text-[9px] uppercase hover:underline ml-2 flex-shrink-0">Профіль</button>
                    </div>
                  ))}
                </div>
              </section>

              <section className="bg-(--card) rounded-2xl sm:rounded-[2.5rem] shadow-sm border border-(--brd) p-6 sm:p-8">
                <h2 className="text-lg font-black mb-6 flex items-center gap-2 uppercase tracking-tight text-(--t1)"><History className="text-blue-600" /> {t.profile.submitsSection}</h2>
                <div className="space-y-3">
                  {[
                    { task: "Проєкт A - API", time: "21.03.2026", color: "text-green-600", Icon: CheckCircle },
                    { task: "Frontend Base",  time: "20.03.2026", color: "text-blue-600",  Icon: Clock },
                    { task: "Auth System",    time: "18.03.2026", color: "text-red-600",   Icon: XCircle },
                  ].map((s, i) => (
                    <div key={i} className="flex items-center justify-between p-4 rounded-2xl bg-(--bg)/50 border border-(--brd) hover:border-blue-600/20 transition-all">
                      <div className="flex items-center gap-3">
                        <s.Icon className={s.color} size={20} />
                        <div><p className="font-bold text-sm leading-none mb-1">{s.task}</p><p className="text-[9px] font-bold text-(--t2) uppercase tracking-wider">{s.time}</p></div>
                      </div>
                      <span className={`text-[8px] font-black uppercase px-2 py-1 rounded-md bg-(--card) border border-(--brd) ${s.color}`}>{i === 0 ? "success" : i === 1 ? "pending" : "failed"}</span>
                    </div>
                  ))}
                </div>
              </section>
            </div>
          </div>

          <footer className="mt-10 text-center text-[10px] font-black uppercase tracking-[0.2em] text-(--t2) opacity-50">
            * {t.profile.updated}: {new Date().toLocaleTimeString()}
          </footer>
        </div>
      </main>
      </div>
    );
  }

  return (
    <div className="flex h-screen overflow-hidden bg-(--bg) text-(--t1) transition-colors duration-300">
    <div
    className={`fixed inset-0 flex items-center justify-center pointer-events-none z-0 ${
      dark ? "opacity-10" : "opacity-5"
    }`}
    >
    <img
    src="/logo_background1.png"
    alt=""
    className={`w-[min(800px,90vw)] h-[min(800px,90vw)] object-contain blur-sm ${
      dark ? "invert" : ""
    }`}
    />
    </div>

    {isMobileSidebarOpen && (
      <div
      className="fixed inset-0 bg-black/50 backdrop-blur-sm z-40 lg:hidden"
      onClick={() => setIsMobileSidebarOpen(false)}
      />
    )}

    <div
    className={`fixed inset-y-0 left-0 z-50 lg:relative lg:translate-x-0 transition-transform duration-300 ease-in-out ${
      isMobileSidebarOpen ? "translate-x-0" : "-translate-x-full lg:translate-x-0"
    }`}
    >
    <Sidebar />
    </div>

    <main className="flex-1 flex flex-col min-w-0 overflow-hidden">
    <MobileHeader
    onOpenSidebar={() => setIsMobileSidebarOpen(true)}
    title="Profile"
    icon={<User size={18} className="text-blue-600" />}
    />

    <div className="flex-1 overflow-y-auto p-4 sm:p-6 md:p-8 lg:p-12 relative z-10">
    <nav className="flex items-center gap-2 text-[10px] font-black mb-6 uppercase tracking-widest text-(--t2)">
    <button onClick={() => router.push("/")} className="hover:text-blue-600 transition-colors">
    Home
    </button>
    <span className="text-(--t1)">Profile</span>
    </nav>

    <h1 className="text-3xl font-black text-(--t1) mb-8 uppercase tracking-tight">
    My Profile
    </h1>

    <div className="max-w-2xl space-y-6">
    {/* Error Message */}
    {error && (
      <div className="bg-red-500/10 border border-red-500/20 rounded-2xl p-4 flex items-center gap-3">
      <AlertCircle size={20} className="text-red-500 flex-shrink-0" />
      <p className="text-red-500 text-sm font-bold">{error}</p>
      </div>
    )}

    {/* Success Message */}
    {success && (
      <div className="bg-green-500/10 border border-green-500/20 rounded-2xl p-4 flex items-center gap-3">
      <CheckCircle size={20} className="text-green-500 flex-shrink-0" />
      <p className="text-green-500 text-sm font-bold">{success}</p>
      </div>
    )}

    {/* Avatar Section */}
    <section className="bg-(--card) rounded-2xl sm:rounded-[2.5rem] shadow-sm border border-(--brd) p-6 sm:p-8">
    <h2 className="text-sm font-black mb-4 uppercase tracking-widest text-blue-600 flex items-center gap-2">
    <Camera size={16} /> Profile Picture
    </h2>

    <div className="flex flex-col sm:flex-row items-center gap-6">
    <div className="relative flex-shrink-0">
    <div className="w-24 h-24 sm:w-32 sm:h-32 rounded-full bg-blue-600/10 flex items-center justify-center border-4 border-(--brd) shadow-md">
    <span className="text-5xl font-black text-blue-600">
    {currentUser.username?.charAt(0).toUpperCase() ?? "?"}
    </span>
    </div>
    </div>

    <div className="flex flex-col gap-3">
    <button
    onClick={() => fileInputRef.current?.click()}
    disabled={isSaving}
    className="px-6 py-3 rounded-xl bg-blue-600 text-white font-black text-xs uppercase tracking-widest hover:bg-blue-700 transition-all active:scale-95 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
    >
    {isSaving ? (
      <>
      <Loader size={14} className="animate-spin" />
      Uploading...
      </>
    ) : (
      <>
      <Camera size={14} />
      Upload Picture
      </>
    )}
    </button>
    <input
    ref={fileInputRef}
    type="file"
    accept="image/*"
    onChange={handleAvatarChange}
    className="hidden"
    />
    <p className="text-[10px] font-bold text-(--t2) uppercase tracking-wider">
    JPG, PNG up to 5MB
    </p>
    </div>
    </div>
    </section>

    {/* Account Info Section */}
    <section className="bg-(--card) rounded-2xl sm:rounded-[2.5rem] shadow-sm border border-(--brd) p-6 sm:p-8">
    <div className="flex items-center justify-between mb-6">
    <h2 className="text-sm font-black uppercase tracking-widest text-blue-600 flex items-center gap-2">
    <Edit2 size={16} /> Account Information
    </h2>
    {!isEditing && (
      <button
      onClick={() => setIsEditing(true)}
      className="text-[10px] font-black uppercase tracking-widest text-blue-600 hover:text-blue-700 transition-colors"
      >
      Edit
      </button>
    )}
    </div>

    <div className="space-y-4">
    {/* Username */}
    <div>
    <label className="text-[10px] font-bold text-(--t2) uppercase tracking-wider block mb-2">
    Username
    </label>
    <input
    type="text"
    value={username}
    onChange={(e) => setUsername(e.target.value)}
    disabled={!isEditing}
    className="w-full px-4 py-3 rounded-xl bg-(--bg) border border-(--brd) text-sm font-bold text-(--t1) focus:outline-none focus:border-blue-600 focus:ring-2 focus:ring-blue-600/20 disabled:opacity-50 disabled:cursor-not-allowed transition-all"
    />
    </div>

    {/* Email */}
    <div>
    <label className="text-[10px] font-bold text-(--t2) uppercase tracking-wider block mb-2">
    Email
    </label>
    <input
    type="email"
    value={email}
    onChange={(e) => setEmail(e.target.value)}
    disabled={!isEditing}
    className="w-full px-4 py-3 rounded-xl bg-(--bg) border border-(--brd) text-sm font-bold text-(--t1) focus:outline-none focus:border-blue-600 focus:ring-2 focus:ring-blue-600/20 disabled:opacity-50 disabled:cursor-not-allowed transition-all"
    />
    </div>

    {/* Login (Read-only) */}
    <div>
    <label className="text-[10px] font-bold text-(--t2) uppercase tracking-wider block mb-2">
    Login
    </label>
    <input
    type="text"
    value={currentUser.login}
    disabled
    className="w-full px-4 py-3 rounded-xl bg-(--bg) border border-(--brd) text-sm font-bold text-(--t2) opacity-50 cursor-not-allowed"
    />
    </div>

    {/* Role Badge */}
    <div>
    <label className="text-[10px] font-bold text-(--t2) uppercase tracking-wider block mb-2">
    Role
    </label>
    <span
    className={`inline-block text-[10px] font-black uppercase px-3 py-2 rounded-lg border ${
      roleBadgeColor[currentUser.role] ?? roleBadgeColor.user
    }`}
    >
    {currentUser.role}
    </span>
    </div>
    </div>

    {/* Save/Cancel Buttons */}
    {isEditing && (
      <div className="mt-6 flex gap-3">
      <button
      onClick={handleSaveProfile}
      disabled={isSaving}
      className="flex-1 px-6 py-3 rounded-xl bg-green-600 text-white font-black text-xs uppercase tracking-widest hover:bg-green-700 transition-all active:scale-95 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
      >
      {isSaving ? (
        <>
        <Loader size={14} className="animate-spin" />
        Saving...
        </>
      ) : (
        "Save Changes"
      )}
      </button>
      <button
      onClick={() => {
        setIsEditing(false);
        setUsername(currentUser.username);
        setEmail(currentUser.email);
        setError(null);
      }}
      disabled={isSaving}
      className="flex-1 px-6 py-3 rounded-xl bg-(--brd) text-(--t2) font-black text-xs uppercase tracking-widest hover:bg-opacity-80 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
      >
      Cancel
      </button>
      </div>
    )}
    </section>

    {/* Account Status Section */}
    <section className="bg-(--card) rounded-2xl sm:rounded-[2.5rem] shadow-sm border border-(--brd) p-6 sm:p-8">
    <h2 className="text-sm font-black mb-4 uppercase tracking-widest text-blue-600 flex items-center gap-2">
    <Shield size={16} /> Account Status
    </h2>

    <div className="space-y-3 text-sm">
    <p className="flex items-center justify-between">
    <span className="text-(--t2) font-bold">Account ID:</span>
    <span className="font-mono text-[10px] break-all">{currentUser.id}</span>
    </p>
    <p className="flex items-center justify-between">
    <span className="text-(--t2) font-bold">Account Status:</span>
    <span className="text-green-500 font-bold uppercase text-[10px]">Active</span>
    </p>
    <p className="flex items-center justify-between">
    <span className="text-(--t2) font-bold">Role Level:</span>
    <span className="font-bold uppercase text-[10px]">
    {currentUser.role === "superadmin"
      ? "Administrator"
      : currentUser.role === "admin"
      ? "Moderator"
      : currentUser.role === "jury"
      ? "Jury"
      : "Member"}
      </span>
      </p>
      </div>
      </section>

      {/* Logout Button */}
      <button
      onClick={logout}
      className="w-full px-6 py-3 rounded-2xl bg-red-600 text-white font-black text-xs uppercase tracking-widest hover:bg-red-700 transition-all active:scale-95 flex items-center justify-center gap-2 shadow-lg shadow-red-600/20"
      >
      <LogOut size={16} /> Sign Out
      </button>
      </div>
      </div>
      </main>
      </div>
  );
}
