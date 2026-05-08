"use client";

import React from "react";
import { Menu, Trophy } from "lucide-react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/context/AuthContext";

interface MobileHeaderProps {
  onOpenSidebar: () => void;
  title?: string;
  icon?: React.ReactNode;
}

export default function MobileHeader({
  onOpenSidebar,
  title = "Code Future",
  icon,
}: MobileHeaderProps) {
  const router = useRouter();
  const { user } = useAuth();
  const avatarLetter = user?.username?.charAt(0).toUpperCase() ?? "?";
  const avatarUrl = user?.avatar_url ?? null;

  return (
    <header className="lg:hidden p-4 flex items-center justify-between bg-(--card) border-b border-(--brd) sticky top-0 z-30">
      <button
        onClick={onOpenSidebar}
        className="p-2 rounded-xl bg-(--bg) border border-(--brd) text-(--t1) active:scale-95 transition-transform"
      >
        <Menu size={24} />
      </button>

      <div className="flex items-center gap-2">
        {icon ?? (
          <div className="w-7 h-7 bg-blue-600 rounded-lg flex items-center justify-center text-white">
            <Trophy size={16} />
          </div>
        )}
        <span className="font-black text-xs uppercase tracking-tighter">{title}</span>
      </div>

      <a
        href="/profile"
        onClick={(e) => { e.preventDefault(); router.push("/profile"); }}
        className="active:scale-95 transition-transform"
      >
        <div className="w-10 h-10 rounded-full overflow-hidden border-2 border-(--brd) bg-blue-600 flex items-center justify-center">
          {avatarUrl ? (
            <img
              src={avatarUrl}
              alt="avatar"
              className="w-full h-full object-cover"
            />
          ) : (
            <span className="text-white font-bold text-xs">{avatarLetter}</span>
          )}
        </div>
      </a>
    </header>
  );
}
