//site_turing_CrutchMasters_team-s/frontend/src/app/profile/page.tsx
"use client";

import React, { useState, useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import {
  User, Mail, Shield, LogOut, Camera, Edit2, CheckCircle, AlertCircle, Loader,
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
  const { user: currentUser, token, logout, isLoading, updateUser } = useAuth();

  const [isLoadingProfile, setIsLoadingProfile] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  const [username, setUsername] = useState("");
  const [email, setEmail] = useState("");
  const [isSaving, setIsSaving] = useState(false);
  const [isEditing, setIsEditing] = useState(false);

  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (isLoading) return;

    if (!currentUser) {
      router.push("/login");
      return;
    }

    setUsername(currentUser.username || "");
    setEmail(currentUser.email || "");
    setIsLoadingProfile(false);
  }, [isLoading, currentUser, router]);

  const handleSaveProfile = async () => {
    if (!currentUser || !token) return;

    setIsSaving(true);
    setError(null);
    setSuccess(null);

    try {
      const { error: updateError } = await supabase
      .from("account")
      .update({
        username,
        email,
      })
      .eq("id", currentUser.id);

      if (updateError) throw updateError;

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

      const fileName = `avatar_${currentUser.id}_${Date.now()}`;
      const { error: uploadError } = await supabase.storage
      .from("avatars")
      .upload(fileName, file, { upsert: true });

      if (uploadError) throw uploadError;

      const { data } = supabase.storage
      .from("avatars")
      .getPublicUrl(fileName);

      const { error: updateError } = await supabase
      .from("account")
      .update({ avatar_url: data.publicUrl })
      .eq("id", currentUser.id);

      if (updateError) throw updateError;

      // Оновлюємо контекст і localStorage — сайдбар одразу покаже новий аватар
      updateUser({ avatar_url: data.publicUrl });

      setSuccess("Avatar uploaded successfully");
    } catch (e: any) {
      console.error("Avatar upload error:", e.message);
      setError(e.message || "Failed to upload avatar");
    } finally {
      setIsSaving(false);
    }
  };

  if (isLoading) {
    return (
      <div className="min-h-screen bg-(--bg) flex items-center justify-center">
      <div className="w-8 h-8 border-2 border-blue-600 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  if (!currentUser) {
    return null;
  }

  if (isLoadingProfile) {
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
      title="Profile"
      icon={<User size={18} className="text-blue-600" />}
      />

      <div className="flex-1 flex items-center justify-center">
      <div className="w-8 h-8 border-2 border-blue-600 border-t-transparent rounded-full animate-spin" />
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
    {error && (
      <div className="bg-red-500/10 border border-red-500/20 rounded-2xl p-4 flex items-center gap-3">
      <AlertCircle size={20} className="text-red-500 flex-shrink-0" />
      <p className="text-red-500 text-sm font-bold">{error}</p>
      </div>
    )}

    {success && (
      <div className="bg-green-500/10 border border-green-500/20 rounded-2xl p-4 flex items-center gap-3">
      <CheckCircle size={20} className="text-green-500 flex-shrink-0" />
      <p className="text-green-500 text-sm font-bold">{success}</p>
      </div>
    )}

    <section className="bg-(--card) rounded-2xl sm:rounded-[2.5rem] shadow-sm border border-(--brd) p-6 sm:p-8">
    <h2 className="text-sm font-black mb-4 uppercase tracking-widest text-blue-600 flex items-center gap-2">
    <Camera size={16} /> Profile Picture
    </h2>

    <div className="flex flex-col sm:flex-row items-center gap-6">
    <div className="relative flex-shrink-0">
    <div className="w-24 h-24 sm:w-32 sm:h-32 rounded-full bg-blue-600/10 border-4 border-(--brd) shadow-md overflow-hidden flex items-center justify-center">
    {currentUser.avatar_url ? (
      <img
      src={currentUser.avatar_url}
      alt="Avatar"
      className="w-full h-full object-cover"
      />
    ) : (
      <span className="text-5xl font-black text-blue-600">
      {currentUser.username?.charAt(0).toUpperCase() ?? "?"}
      </span>
    )}
    </div>
    {/* Кнопка-камера поверх аватара */}
    <button
    onClick={() => fileInputRef.current?.click()}
    disabled={isSaving}
    className="absolute bottom-0 right-0 w-8 h-8 rounded-full bg-blue-600 border-2 border-(--card) flex items-center justify-center text-white hover:bg-blue-700 transition active:scale-95 disabled:opacity-50"
    title="Change avatar"
    >
    <Camera size={14} />
    </button>
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
