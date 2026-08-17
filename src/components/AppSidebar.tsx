"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { supabase } from '@/lib/supabase';
import React, { useState, useEffect } from "react";

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
  const [defaultView, setDefaultView] = useState('/app');
  const [isProfileMenuOpen, setIsProfileMenuOpen] = useState(false);
  const [isDesktopCollapsed, setIsDesktopCollapsed] = useState(false);
  const profileMenuRef = React.useRef<HTMLDivElement>(null);

  useEffect(() => {
    const stored = localStorage.getItem('venote_sidebar_collapsed');
    if (stored === 'true') setIsDesktopCollapsed(true);
  }, []);

  useEffect(() => {
    localStorage.setItem('venote_sidebar_collapsed', String(isDesktopCollapsed));
  }, [isDesktopCollapsed]);

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (profileMenuRef.current && !profileMenuRef.current.contains(event.target as Node)) {
        setIsProfileMenuOpen(false);
      }
    }
    
    function handleEscape(event: KeyboardEvent) {
      if (event.key === 'Escape') {
        setIsProfileMenuOpen(false);
      }
    }

    if (isProfileMenuOpen) {
      document.addEventListener('mousedown', handleClickOutside);
      document.addEventListener('keydown', handleEscape);
    }
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      document.removeEventListener('keydown', handleEscape);
    };
  }, [isProfileMenuOpen]);

  useEffect(() => {
    if (session?.user?.id) {
      supabase.from('user_settings').select('default_view').eq('user_id', session.user.id).single()
        .then(({ data }) => {
          if (data?.default_view) setDefaultView(data.default_view);
        });
    }
  }, [session?.user?.id]);

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
      <aside className={`fixed top-0 left-0 z-50 transform transition-all duration-300 md:relative md:translate-x-0 w-[272px] ${isDesktopCollapsed ? 'md:w-[72px]' : 'md:w-[272px]'} glass-sidebar flex flex-col h-[100dvh] md:h-screen md:sticky md:top-0 shrink-0 ${isMobileMenuOpen ? 'translate-x-0 pointer-events-auto' : '-translate-x-full pointer-events-none md:pointer-events-auto'}`}>
        {/* Desktop collapse/expand toggle */}
        <button
          type="button"
          onClick={() => setIsDesktopCollapsed(!isDesktopCollapsed)}
          title={isDesktopCollapsed ? 'Expand sidebar' : 'Collapse sidebar'}
          className="hidden md:flex absolute -right-3 top-6 z-10 w-6 h-6 items-center justify-center rounded-full bg-[#1A1714] border border-white/10 text-[#A6988D] hover:text-primary-text hover:border-white/20 transition-colors shadow-md"
        >
          <svg xmlns="http://www.w3.org/2000/svg" className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            {isDesktopCollapsed ? (
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
            ) : (
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
            )}
          </svg>
        </button>

        <div className={`p-4 md:p-5 pb-3 space-y-4 ${isDesktopCollapsed ? 'md:px-3' : ''}`}>
          {/* Logo */}
          <Link href={defaultView} className="flex items-center gap-3">
            <svg width="32" height="32" viewBox="0 0 32 32" fill="none" xmlns="http://www.w3.org/2000/svg" className="shrink-0">
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
            <span className={`font-serif italic font-bold text-[32px] tracking-tight leading-none pt-1 text-[#F5EDD9] ${isDesktopCollapsed ? 'md:hidden' : ''}`}>Venote</span>
          </Link>

          {/* Organize & New Note buttons based on activePath */}
          {activePath === "/app/quick-notes" ? (
            <>
              <Link
                href={defaultView}
                title="Organize"
                className={`w-full flex items-center justify-center gap-2 px-4 ${isDesktopCollapsed ? 'md:px-0' : ''} py-2.5 glass-panel text-primary-accent font-medium rounded-2xl transition-all border border-primary-accent/30 shadow-sm hover:border-primary-accent/50`}
              >
                <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" />
                </svg>
                <span className={isDesktopCollapsed ? 'md:hidden' : ''}>Organize</span>
              </Link>

              <button
                type="button"
                onClick={onNewNote}
                title="New note"
                className={`w-full flex items-center justify-center gap-2 px-4 ${isDesktopCollapsed ? 'md:px-0' : ''} py-3 bg-gradient-to-r from-[#FF5C38] to-[#FF451A] text-white font-semibold rounded-2xl hover:brightness-110 active:scale-[0.98] transition-all shadow-[0_4px_18px_0_rgba(255,92,56,0.35),inset_0_1px_0_0_rgba(255,255,255,0.25)] border border-white/15`}
              >
                <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 shrink-0" viewBox="0 0 20 20" fill="currentColor">
                  <path fillRule="evenodd" d="M10 3a1 1 0 011 1v5h5a1 1 0 110 2h-5v5a1 1 0 11-2 0v-5H4a1 1 0 110-2h5V4a1 1 0 011-1z" clipRule="evenodd" />
                </svg>
                <span className={isDesktopCollapsed ? 'md:hidden' : ''}>New note</span>
              </button>
            </>
          ) : (
            <Link
              href={defaultView}
              onClick={activePath === "/app" ? onNewNote : undefined}
              title="Organize"
              className={`w-full flex items-center justify-center gap-2 px-4 ${isDesktopCollapsed ? 'md:px-0' : ''} py-3 bg-gradient-to-r from-[#FF5C38] to-[#FF451A] text-white font-semibold rounded-2xl hover:brightness-110 active:scale-[0.98] transition-all shadow-[0_4px_18px_0_rgba(255,92,56,0.35),inset_0_1px_0_0_rgba(255,255,255,0.25)] border border-white/15`}
            >
              <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" />
              </svg>
              <span className={isDesktopCollapsed ? 'md:hidden' : ''}>Organize</span>
            </Link>
          )}

          <div className={`flex ${isDesktopCollapsed ? 'md:flex-col' : ''} items-center gap-2 w-full`}>
            <Link
              href="/app/quick-notes"
              title="Quick Notes"
              className={`flex-1 ${isDesktopCollapsed ? 'md:flex-none md:w-full' : ''} flex justify-center items-center py-3 rounded-2xl transition-all border group relative ${
                activePath === "/app/quick-notes"
                  ? "glass-panel text-primary-accent border-primary-accent/40 shadow-[0_4px_16px_0_rgba(255,92,56,0.15)]"
                  : "glass-panel-subtle text-[#A6988D] border-white/5 hover:border-white/15 hover:bg-white/[0.06] hover:text-primary-text"
              }`}
            >
              <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
              </svg>
              <div className="absolute -top-10 left-1/2 -translate-x-1/2 px-2.5 py-1 glass-panel-modal border border-white/15 rounded-xl text-xs font-medium text-primary-text opacity-0 group-hover:opacity-100 pointer-events-none transition-opacity whitespace-nowrap shadow-xl">
                Quick Notes
              </div>
            </Link>
            <Link
              href="/app/schedule"
              title="Schedule"
              data-tour="nav-schedule"
              className={`flex-1 ${isDesktopCollapsed ? 'md:flex-none md:w-full' : ''} flex justify-center items-center py-3 rounded-2xl transition-all border group relative ${
                activePath === "/app/schedule"
                  ? "glass-panel text-primary-accent border-primary-accent/40 shadow-[0_4px_16px_0_rgba(255,92,56,0.15)]"
                  : "glass-panel-subtle text-[#A6988D] border-white/5 hover:border-white/15 hover:bg-white/[0.06] hover:text-primary-text"
              }`}
            >
              <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
              </svg>
              <div className="absolute -top-10 left-1/2 -translate-x-1/2 px-2.5 py-1 glass-panel-modal border border-white/15 rounded-xl text-xs font-medium text-primary-text opacity-0 group-hover:opacity-100 pointer-events-none transition-opacity whitespace-nowrap shadow-xl">
                Schedule
              </div>
            </Link>
            <Link
              href="/app/this-week"
              title="Dashboard"
              className={`flex-1 ${isDesktopCollapsed ? 'md:flex-none md:w-full' : ''} flex justify-center items-center py-3 rounded-2xl transition-all border group relative ${
                activePath === "/app/this-week"
                  ? "glass-panel text-primary-accent border-primary-accent/40 shadow-[0_4px_16px_0_rgba(255,92,56,0.15)]"
                  : "glass-panel-subtle text-[#A6988D] border-white/5 hover:border-white/15 hover:bg-white/[0.06] hover:text-primary-text"
              }`}
            >
              <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 3.055A9.001 9.001 0 1020.945 13H11V3.055z" />
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20.488 9H15V3.512A9.025 9.025 0 0120.488 9z" />
              </svg>
              <div className="absolute -top-10 left-1/2 -translate-x-1/2 px-2.5 py-1 glass-panel-modal border border-white/15 rounded-xl text-xs font-medium text-primary-text opacity-0 group-hover:opacity-100 pointer-events-none transition-opacity whitespace-nowrap shadow-xl">
                Dashboard
              </div>
            </Link>
          </div>
          

          <div className={`flex flex-col ${isDesktopCollapsed ? 'md:flex-col' : 'md:flex-row'} gap-2 w-full mt-2`}>
            <Link
              href="/app/expenses"
              title="Wallet"
              data-tour="nav-wallet"
              className={`flex-1 ${isDesktopCollapsed ? 'md:flex-none md:w-full' : ''} flex justify-center items-center gap-1.5 px-2 py-3 font-medium rounded-2xl transition-all border group relative ${
                activePath === "/app/expenses"
                  ? "glass-panel text-primary-accent border-primary-accent/40 shadow-[0_4px_16px_0_rgba(255,92,56,0.15)]"
                  : "glass-panel-subtle text-[#A6988D] border-white/5 hover:border-white/15 hover:bg-white/[0.06] hover:text-primary-text"
              }`}
            >
              <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              <span className={`truncate ${isDesktopCollapsed ? 'md:hidden' : ''}`}>Wallet</span>
            </Link>

            <Link
              href="/app/rounds"
              title="Job"
              data-tour="nav-job"
              className={`flex-1 ${isDesktopCollapsed ? 'md:flex-none md:w-full' : ''} flex justify-center items-center gap-1.5 px-2 py-3 font-medium rounded-2xl transition-all border group relative ${
                activePath === "/app/rounds"
                  ? "glass-panel text-primary-accent border-primary-accent/40 shadow-[0_4px_16px_0_rgba(255,92,56,0.15)]"
                  : "glass-panel-subtle text-[#A6988D] border-white/5 hover:border-white/15 hover:bg-white/[0.06] hover:text-primary-text"
              }`}
            >
              <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 13.255A23.931 23.931 0 0112 15c-3.183 0-6.22-.62-9-1.745M16 6V4a2 2 0 00-2-2h-4a2 2 0 00-2 2v2m4 6h.01M5 20h14a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
              </svg>
              <span className={`truncate ${isDesktopCollapsed ? 'md:hidden' : ''}`}>Job</span>
            </Link>
          </div>

          {/* Settings link removed - now in profile popup */}
        </div>

        <div className={isDesktopCollapsed ? 'md:hidden' : ''}>{children}</div>

        {!hideProfile && (
          <div className="mt-auto p-3 md:p-4 border-t border-white/10 glass-panel-subtle shrink-0 relative z-10" ref={profileMenuRef}>

            {/* Profile Popup Menu */}
            {isProfileMenuOpen && (
              <div className={`absolute bottom-[calc(100%+8px)] left-3 right-3 ${isDesktopCollapsed ? 'md:left-2 md:right-auto md:w-60' : ''} glass-panel-modal border border-white/10 rounded-2xl shadow-[0_-8px_32px_rgba(0,0,0,0.4)] overflow-hidden animate-in fade-in slide-in-from-bottom-2 duration-200`}>
                <div className="flex flex-col p-1.5">
                  <Link
                    href="/app/settings"
                    onClick={() => setIsProfileMenuOpen(false)}
                    className="flex items-center gap-2 px-3 py-2.5 text-sm font-medium text-primary-text hover:bg-white/10 rounded-xl transition-colors"
                  >
                    <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 text-[#A6988D]" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                    </svg>
                    Settings
                  </Link>
                  <button
                    onClick={() => {
                      setIsProfileMenuOpen(false);
                      handleLogOut();
                    }}
                    className="flex items-center gap-2 px-3 py-2.5 text-sm font-medium text-red-400 hover:bg-red-500/10 hover:text-red-300 rounded-xl transition-colors w-full text-left"
                  >
                    <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
                    </svg>
                    Sign out
                  </button>
                </div>
              </div>
            )}

            <div
              data-tour="nav-settings"
              className={`flex items-center gap-3 px-1 cursor-pointer hover:bg-white/5 p-2 -mx-2 rounded-xl transition-colors ${isDesktopCollapsed ? 'md:justify-center' : ''}`}
              onClick={() => setIsProfileMenuOpen(!isProfileMenuOpen)}
              title={isDesktopCollapsed ? displayName : undefined}
            >
              <div className="w-8 h-8 rounded-full bg-gradient-to-br from-[#FF5C38] to-[#FF8F77] flex items-center justify-center text-white text-sm font-bold shadow-md shrink-0 border border-white/20">
                {initial}
              </div>
              <div className={`flex flex-col overflow-hidden leading-tight flex-1 ${isDesktopCollapsed ? 'md:hidden' : ''}`}>
                <div className="text-sm font-medium text-primary-text truncate">{displayName}</div>
                <div className="text-[11px] text-[#A6988D] truncate">{session?.user?.email}</div>
              </div>
              <svg xmlns="http://www.w3.org/2000/svg" className={`h-4 w-4 text-[#A6988D] transition-transform shrink-0 ${isProfileMenuOpen ? 'rotate-180' : ''} ${isDesktopCollapsed ? 'md:hidden' : ''}`} fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 15l7-7 7 7" />
              </svg>
            </div>
          </div>
        )}
      </aside>
    </>
  );
}
