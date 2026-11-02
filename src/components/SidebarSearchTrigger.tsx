'use client';

import { useEffect, useState } from 'react';
import { useCommands, type PaletteSearchContext } from './CommandPaletteProvider';

export default function SidebarSearchTrigger({ collapsed, context, onOpen }: { collapsed: boolean; context?: PaletteSearchContext; onOpen?: () => void }) {
  const { openPalette } = useCommands();
  const [shortcut, setShortcut] = useState('Ctrl K');
  useEffect(() => { setShortcut(/Mac|iPhone|iPad/.test(navigator.platform) ? '⌘K' : 'Ctrl K'); }, []);
  const open = () => { openPalette(context); onOpen?.(); };
  return <button type="button" aria-label="Search Venote" title="Search (Cmd K)"
    onClick={open} onFocus={open}
    className={`venote-sidebar-search relative flex min-h-11 min-w-0 flex-1 items-center gap-2 rounded-2xl border border-card-border glass-panel-subtle pl-2.5 pr-3 text-sm text-muted-text hover:text-primary-text focus-visible:outline-2 focus-visible:outline-primary-accent focus-visible:outline-offset-2 ${collapsed ? 'md:justify-center md:px-0' : ''}`}>
    <svg aria-hidden="true" className="h-4 w-4 shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8"><circle cx="10.5" cy="10.5" r="6.5"/><path d="m16 16 5 5"/></svg>
    <span className={`min-w-0 flex-1 truncate text-left ${collapsed ? 'md:hidden' : ''}`}>Search</span>
    <kbd className={`venote-sidebar-search-hint shrink-0 rounded-md border border-hairline bg-surface-brown/40 px-1.5 py-0.5 font-mono text-[11px] text-primary-text ${collapsed ? 'md:hidden' : ''}`}>{shortcut}</kbd>
  </button>;
}
