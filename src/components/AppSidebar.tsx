"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { supabase } from '@/lib/supabase';
import React from "react";

interface AppSidebarProps {
  activePath: string;
  isMobileMenuOpen: boolean;
  onCloseMenu: () => void;
  session: any;
  hideProfile?: boolean;
  onNewNote?: () => void;
  children?: React.ReactNode;
}

export default function AppSidebar({
  activePath,
  isMobileMenuOpen,
  onCloseMenu,
  session,
  hideProfile = false,
  onNewNote,
  children,
}: AppSidebarProps) {
  const router = useRouter();

  const handleLogOut = async () => {
    await supabase.auth.signOut();
    router.push('/login');
  };

  const displayName = session?.user?.user_metadata?.name 
    || session?.user?.user_metadata?.full_name 
    || session?.user?.email?.split('@')[0] 
    || session?.user?.email 
    || '?';
  const initial = displayName ? displayName.charAt(0).toUpperCase() : '?';

  return (
    <>
      {/* Mobile Drawer Backdrop */}
      {isMobileMenuOpen && (
        <div 
          className="fixed inset-0 bg-black/60 backdrop-blur-sm z-40 md:hidden"
          onClick={onCloseMenu}
        />
      )}

      {/* Sidebar */}
      <aside className={`fixed top-0 left-0 z-50 transform transition-transform duration-300 md:relative md:translate-x-0 w-[272px] bg-sidebar border-r border-hairline flex flex-col h-[100dvh] md:h-screen md:sticky md:top-0 shrink-0 ${isMobileMenuOpen ? 'translate-x-0 pointer-events-auto' : '-translate-x-full pointer-events-none md:pointer-events-auto'}`}>
        <div className="p-4 md:p-5 pb-3 space-y-4">
          {/* Logo */}
          <Link href="/app" className="flex items-center gap-3">
            <svg width="32" height="32" viewBox="0 0 32 32" fill="none" xmlns="http://www.w3.org/2000/svg">
              <rect width="32" height="32" rx="8" fill="url(#logo-grad)"/>
              <defs>
                <linearGradient id="logo-grad" x1="0" y1="0" x2="32" y2="32" gradientUnits="userSpaceOnUse">
                  <stop stopColor="#FF6B3D"/>
                  <stop offset="1" stopColor="#FF3B1D"/>
                </linearGradient>
              </defs>
              <path d="M14.5 22.5L9 11.5H13L16 18L21 9H25L17.5 22.5H14.5Z" fill="white"/>
              <circle cx="8" cy="14" r="1.5" fill="white"/>
              <circle cx="10" cy="20" r="1" fill="white"/>
              <circle cx="7" cy="18" r="1" fill="white"/>
              <polygon points="10,8 13,10 9,11" fill="white"/>
              <polygon points="8,21 12,23 9,24" fill="white"/>
              <polygon points="12,14 15,16 12,17" fill="white"/>
            </svg>
            <span className="font-serif italic font-bold text-[32px] tracking-tight leading-none pt-1 text-[#F5EDD9]">Venote</span>
          </Link>

          {/* Organize & New Note buttons based on activePath */}
          {activePath === "/app/quick-notes" ? (
            <>
              <Link
                href="/app"
                className="w-full flex items-center justify-center gap-2 px-4 py-2.5 bg-primary-accent/10 text-primary-accent font-medium rounded-xl transition-all border border-primary-accent/20 shadow-sm"
              >
                <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" />
                </svg>
                Organize
              </Link>

              <button
                type="button"
                onClick={onNewNote}
                className="w-full flex items-center justify-center gap-2 px-4 py-3 bg-primary-accent text-primary-text font-medium rounded-xl hover:brightness-110 transition-all shadow-[0_4px_14px_0_rgba(255,92,56,0.39)]"
              >
                <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" viewBox="0 0 20 20" fill="currentColor">
                  <path fillRule="evenodd" d="M10 3a1 1 0 011 1v5h5a1 1 0 110 2h-5v5a1 1 0 11-2 0v-5H4a1 1 0 110-2h5V4a1 1 0 011-1z" clipRule="evenodd" />
                </svg>
                New note
              </button>
            </>
          ) : (
            <Link
              href="/app"
              onClick={activePath === "/app" ? onNewNote : undefined}
              className="w-full flex items-center justify-center gap-2 px-4 py-3 bg-primary-accent text-primary-text font-medium rounded-xl hover:brightness-110 transition-all shadow-[0_4px_14px_0_rgba(255,92,56,0.39)]"
            >
              <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" />
              </svg>
              Organize
            </Link>
          )}

          <div className="flex items-center gap-2 w-full">
            <Link
              href="/app/quick-notes"
              className={`flex-1 flex justify-center items-center py-3 rounded-xl transition-all border group relative ${
                activePath === "/app/quick-notes"
                  ? "bg-primary-accent/10 text-primary-accent border-primary-accent/20 shadow-sm"
                  : "bg-background/50 text-muted-text border-transparent hover:border-hairline hover:bg-background hover:text-primary-text"
              }`}
            >
              <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
              </svg>
              <div className="absolute -top-10 left-1/2 -translate-x-1/2 px-2 py-1 bg-card border border-hairline rounded-lg text-xs font-medium text-primary-text opacity-0 group-hover:opacity-100 pointer-events-none transition-opacity whitespace-nowrap shadow-sm">
                Quick Notes
              </div>
            </Link>
            <Link
              href="/app/today"
              className={`flex-1 flex justify-center items-center py-3 rounded-xl transition-all border group relative ${
                activePath === "/app/today"
                  ? "bg-primary-accent/10 text-primary-accent border-primary-accent/20 shadow-sm"
                  : "bg-background/50 text-muted-text border-transparent hover:border-hairline hover:bg-background hover:text-primary-text"
              }`}
            >
              <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
              </svg>
              <div className="absolute -top-10 left-1/2 -translate-x-1/2 px-2 py-1 bg-card border border-hairline rounded-lg text-xs font-medium text-primary-text opacity-0 group-hover:opacity-100 pointer-events-none transition-opacity whitespace-nowrap shadow-sm">
                Today
              </div>
            </Link>
            <Link
              href="/app/this-week"
              className={`flex-1 flex justify-center items-center py-3 rounded-xl transition-all border group relative ${
                activePath === "/app/this-week"
                  ? "bg-primary-accent/10 text-primary-accent border-primary-accent/20 shadow-sm"
                  : "bg-background/50 text-muted-text border-transparent hover:border-hairline hover:bg-background hover:text-primary-text"
              }`}
            >
              <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 3.055A9.001 9.001 0 1020.945 13H11V3.055z" />
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20.488 9H15V3.512A9.025 9.025 0 0120.488 9z" />
              </svg>
              <div className="absolute -top-10 left-1/2 -translate-x-1/2 px-2 py-1 bg-card border border-hairline rounded-lg text-xs font-medium text-primary-text opacity-0 group-hover:opacity-100 pointer-events-none transition-opacity whitespace-nowrap shadow-sm">
                Progress
              </div>
            </Link>
          </div>
          
          <div className="w-full h-px bg-hairline my-2" />

          <Link
            href="/app/expenses"
            className={`w-full flex items-center justify-start gap-2 px-4 py-2.5 font-medium rounded-xl transition-all border ${
              activePath === "/app/expenses"
                ? "bg-primary-accent/10 text-primary-accent border-primary-accent/20 shadow-sm"
                : "bg-background/50 text-muted-text hover:text-primary-text border-transparent hover:border-hairline hover:bg-background"
            }`}
          >
            <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            Expenses
          </Link>
        </div>

        {children}

        {!hideProfile && (
          <div className="mt-auto p-3 md:p-4 border-t border-hairline bg-[#1A1714] shrink-0 relative z-10">
            <div className="flex flex-col gap-2.5">
              <div className="flex items-center gap-3 px-1">
                <div className="w-8 h-8 rounded-full bg-gradient-to-br from-primary-accent to-[#FF8F77] flex items-center justify-center text-background text-sm font-bold shadow-inner shrink-0">
                  {initial}
                </div>
                <div className="flex flex-col overflow-hidden leading-tight">
                  <div className="text-sm font-medium text-primary-text truncate">{displayName}</div>
                  <div className="text-[11px] text-muted-text truncate opacity-80">{session?.user?.email}</div>
                </div>
              </div>
              <button
                onClick={handleLogOut}
                className="w-full flex items-center justify-start gap-2 px-3 py-2 text-sm text-muted-text hover:text-red-400 font-medium rounded-lg hover:bg-red-400/10 transition-all border border-transparent"
              >
                <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
                </svg>
                Sign out
              </button>
            </div>
          </div>
        )}
      </aside>
    </>
  );
}
