"use client";

import BrandLogo from '@/components/BrandLogo';
import { useCommands } from '@/components/CommandPaletteProvider';
import Link from "next/link";
import React, { useState, useEffect } from "react";
import { supabase } from '@/lib/supabase';

interface AppMobileHeaderProps {
  onOpenMenu: () => void;
  rightContent?: React.ReactNode;
  className?: string;
}

export default function AppMobileHeader({ onOpenMenu, rightContent, className }: AppMobileHeaderProps) {
  const { openPalette } = useCommands();
  const [defaultView, setDefaultView] = useState('/app');

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      if (data?.session?.user?.id) {
        supabase.from('user_settings').select('default_view').eq('user_id', data.session.user.id).single()
          .then(({ data: settings }) => {
            if (settings?.default_view) setDefaultView(settings.default_view);
          });
      }
    });
  }, []);

  return (
    <div className={`venote-mobile-header md:hidden flex shrink-0 items-center justify-between gap-2 border-b border-hairline sticky top-0 z-30 ${className || 'bg-background'}`}>
      <div className="flex min-w-0 items-center gap-1">
        <button type="button" onClick={onOpenMenu} aria-label="Open navigation" title="Open navigation" className="flex h-11 w-11 shrink-0 items-center justify-center text-primary-text rounded-xl hover:bg-surface-brown/40">
          <svg aria-hidden="true" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" /></svg>
        </button>
        <Link href={defaultView} aria-label="Venote home" className="flex min-h-11 min-w-0 items-center"><BrandLogo className="h-9" /></Link>
      </div>
      <div className="flex shrink-0 items-center gap-1">
        {rightContent && <div className="max-w-14 truncate">{rightContent}</div>}
        <button type="button" onClick={() => openPalette()} aria-label="Search Venote" title="Search Venote" className="flex h-11 w-11 items-center justify-center rounded-xl text-muted-text hover:bg-surface-brown/40 hover:text-primary-text">
          <svg aria-hidden="true" className="h-5 w-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8"><circle cx="10.5" cy="10.5" r="6.5"/><path d="m16 16 5 5"/></svg>
        </button>
      </div>
    </div>
  );
}
