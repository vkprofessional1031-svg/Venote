"use client";

import BrandLogo from '@/components/BrandLogo';
import SidebarRowAction from '@/components/SidebarRowAction';
import type { PaletteSearchContext } from '@/components/CommandPaletteProvider';
import SidebarSearchTrigger from './SidebarSearchTrigger';
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
  searchTools?: React.ReactNode;
  searchContext?: PaletteSearchContext;
}

export default function AppSidebar({
  activePath,
  isMobileMenuOpen,
  onCloseMenu,
  session,
  hideProfile = false,
  onNewNote,
  children,
  searchTools,
  searchContext,
}: AppSidebarProps) {
  const router = useRouter();
  useEffect(() => {
    window.addEventListener('venote:close-menu', onCloseMenu);
    return () => window.removeEventListener('venote:close-menu', onCloseMenu);
  }, [onCloseMenu]);
  const [defaultView, setDefaultView] = useState('/app');
  const [isProfileMenuOpen, setIsProfileMenuOpen] = useState(false);
  const [isMobile, setIsMobile] = useState(false);
  useEffect(() => {
    const media = matchMedia('(max-width: 767px)');
    const update = () => setIsMobile(media.matches);
    update(); media.addEventListener('change', update);
    return () => media.removeEventListener('change', update);
  }, []);
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
          className="fixed inset-0 bg-background/80 backdrop-blur-sm z-40 md:hidden"
          onClick={onCloseMenu}
        />
      )}

      {/* Sidebar */}
      <aside data-mobile-menu-open={isMobileMenuOpen ? 'true' : undefined} aria-label="Sidebar" aria-hidden={isMobile && !isMobileMenuOpen ? true : undefined} inert={isMobile && !isMobileMenuOpen ? true : undefined} className={`venote-sidebar fixed top-0 left-0 z-50 transform transition-all duration-300 motion-reduce:transition-none md:relative md:translate-x-0 w-[272px] ${isDesktopCollapsed ? 'md:w-[72px]' : 'md:w-[272px]'} glass-sidebar flex flex-col h-[100dvh] md:h-screen md:sticky md:top-0 shrink-0 ${isMobileMenuOpen ? 'translate-x-0 pointer-events-auto' : '-translate-x-full pointer-events-none md:pointer-events-auto'}`}>
        {/* Desktop collapse/expand toggle */}
        <button
          type="button"
          onClick={() => setIsDesktopCollapsed(!isDesktopCollapsed)}
          title={isDesktopCollapsed ? 'Expand sidebar' : 'Collapse sidebar'}
          aria-label={isDesktopCollapsed ? 'Expand sidebar' : 'Collapse sidebar'}
          aria-expanded={!isDesktopCollapsed}
          className="hidden md:flex absolute -right-3 top-6 z-10 w-6 h-6 items-center justify-center rounded-full bg-card border border-hairline text-muted-text hover:text-primary-text hover:border-primary-accent/40 transition-colors shadow-md"
        >
          <svg xmlns="http://www.w3.org/2000/svg" className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            {isDesktopCollapsed ? (
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
            ) : (
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
            )}
          </svg>
        </button>

        <div className={`p-4 md:p-5 pb-3 space-y-4 venote-sidebar-top shrink-0 overflow-y-auto ${isDesktopCollapsed ? 'md:px-3' : ''}`}>
          {/* Logo */}
          <Link onClick={onCloseMenu} href={defaultView} aria-label="Venote home" className={`flex items-center gap-3 ${isDesktopCollapsed ? 'md:justify-center' : ''}`}>
            <BrandLogo className={`h-10 ${isDesktopCollapsed ? 'md:hidden' : ''}`} />
            {isDesktopCollapsed && <BrandLogo variant="icon" className="hidden h-10 md:inline-flex" />}
          </Link>

          <nav aria-label="Main navigation" className="flex flex-col gap-1">
            {[
              { href: '/app', label: 'Organize', target: 'organize', path: 'M4 7h16M4 12h16M4 17h10' },
              { href: '/overview', label: 'Overview', path: 'M3 3h7v7H3zM14 3h7v11h-7zM3 14h7v7H3zM14 18h7m-7 3h7' },
              { href: '/app/quick-notes', label: 'Quick Notes', path: 'M13 3 4 14h7v7l9-11h-7V3Z' },
              { href: '/app/schedule', label: 'Schedule', tour: 'nav-schedule', path: 'M8 3v4m8-4v4M4 10h16M5 5h14a1 1 0 0 1 1 1v14H4V6a1 1 0 0 1 1-1Z' },
              { href: '/app/expenses', label: 'Wallet', target: 'wallet', tour: 'nav-wallet', path: 'M20 8V5H5a2 2 0 0 0-2 2v12h17V8H5a1 1 0 0 1 0-2m11 6h4v4h-4z' },
              { href: '/app/rounds', label: 'Job', target: 'job', tour: 'nav-job', path: 'M8 6V4h8v2M3 11l9 4 9-4M3 6h18v14H3zM12 12v4' },
            ].map(item => {
              const active = activePath === item.href;
              return (
                <div key={item.href}
                  data-fly-target={item.target} data-tour={item.tour}
                  className={`flex h-[50px] w-full shrink-0 items-center gap-2 rounded-2xl border pr-2 text-sm font-medium transition-colors motion-reduce:transition-none ${isDesktopCollapsed ? 'md:pr-0' : ''} ${active ? 'text-primary-accent bg-primary-accent/10 border-primary-accent/25' : 'text-muted-text bg-transparent border-transparent hover:bg-surface-brown/50 hover:text-primary-text'}`}>
                  <Link href={item.href} title={item.label} aria-label={item.label}
                    aria-current={active ? 'page' : undefined}
                    onClick={onCloseMenu}
                    className={`flex h-full min-w-0 flex-1 items-center gap-3 rounded-xl pl-3 focus-visible:outline-2 focus-visible:outline-primary-accent focus-visible:outline-offset-2 ${isDesktopCollapsed ? 'md:justify-center md:pl-0' : ''}`}>
                    <svg aria-hidden="true" className="h-5 w-5 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round"><path d={item.path} /></svg>
                    <span className={`min-w-0 truncate ${isDesktopCollapsed ? 'md:hidden' : ''}`}>{item.label}</span>
                  </Link>
                  {active && (item.href === '/app' || item.href === '/app/quick-notes') && (
                    <SidebarRowAction
                      label={item.href === '/app' ? 'New entry' : 'New quick note'}
                      collapsed={isDesktopCollapsed}
                      onClick={() => { onNewNote?.(); onCloseMenu(); }}
                    />
                  )}
                </div>
              );
            })}
          </nav>

          {/* Settings link removed - now in profile popup */}
        </div>

        <div className={`venote-sidebar-search-row shrink-0 px-4 pb-3 ${isDesktopCollapsed ? 'md:px-3' : 'md:px-5'}`}>
          <div className="flex min-w-0 items-center gap-2">
            <SidebarSearchTrigger collapsed={isDesktopCollapsed} context={searchContext} onOpen={onCloseMenu} />
            {searchTools && <div className={`flex shrink-0 items-center gap-2 ${isDesktopCollapsed ? 'md:hidden' : ''}`}>{searchTools}</div>}
          </div>
        </div>
        <div className={`flex-1 flex flex-col min-h-0 ${isDesktopCollapsed ? 'md:hidden' : ''}`}>{children}</div>

        {!hideProfile && (
          <div className="mt-auto p-3 md:p-4 border-t border-hairline glass-panel-subtle shrink-0 relative z-10" ref={profileMenuRef}>

            {/* Profile Popup Menu */}
            {isProfileMenuOpen && (
              <div className={`absolute bottom-[calc(100%+8px)] left-3 right-3 ${isDesktopCollapsed ? 'md:left-2 md:right-auto md:w-60' : ''} glass-panel-modal border border-card-border rounded-2xl shadow-[0_-8px_32px_rgba(0,0,0,0.4)] overflow-hidden animate-in fade-in slide-in-from-bottom-2 duration-200`}>
                <div className="flex flex-col p-1.5">
                  <Link
                    href="/app/settings"
                    onClick={() => { setIsProfileMenuOpen(false); onCloseMenu(); }}
                    className="flex items-center gap-2 px-3 py-2.5 text-sm font-medium text-primary-text hover:bg-surface-brown/50 rounded-xl transition-colors"
                  >
                    <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 text-muted-text" fill="none" viewBox="0 0 24 24" stroke="currentColor">
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
              className={`flex items-center gap-3 px-1 cursor-pointer hover:bg-surface-brown/50 p-2 -mx-2 rounded-xl transition-colors ${isDesktopCollapsed ? 'md:justify-center' : ''}`}
              onClick={() => setIsProfileMenuOpen(!isProfileMenuOpen)}
              title={isDesktopCollapsed ? displayName : undefined}
            >
              <div className="w-8 h-8 rounded-full bg-gradient-to-br from-[#FF5C38] to-[#FF8F77] flex items-center justify-center text-white text-sm font-bold shadow-md shrink-0 border border-white/20">
                {initial}
              </div>
              <div className={`flex flex-col overflow-hidden leading-tight flex-1 ${isDesktopCollapsed ? 'md:hidden' : ''}`}>
                <div className="text-sm font-medium text-primary-text truncate">{displayName}</div>
                <div className="text-[11px] text-muted-text truncate">{session?.user?.email}</div>
              </div>
              <svg xmlns="http://www.w3.org/2000/svg" className={`h-4 w-4 text-muted-text transition-transform shrink-0 ${isProfileMenuOpen ? 'rotate-180' : ''} ${isDesktopCollapsed ? 'md:hidden' : ''}`} fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 15l7-7 7 7" />
              </svg>
            </div>
          </div>
        )}
      </aside>
    </>
  );
}
