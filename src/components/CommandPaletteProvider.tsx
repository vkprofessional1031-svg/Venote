'use client';

import { createContext, useCallback, useContext, useEffect, useRef, useState, type ReactNode } from 'react';
import { usePathname, useRouter } from 'next/navigation';
import CommandPalette from './CommandPalette';

export type PaletteSearchContext = { query?: string; scope?: 'all' | 'entries' | 'quick-notes'; view?: 'normal' | 'archived' | 'trash'; tag?: string };

type Commands = {
  openPalette: (context?: PaletteSearchContext) => void;
  closePalette: () => void;
  navigate: (href: string) => void;
  amountsHidden: boolean;
  setAmountsHidden: (hidden: boolean) => void;
};
const Context = createContext<Commands | null>(null);
export function useCommands() {
  const value = useContext(Context);
  if (!value) throw new Error('CommandPaletteProvider is missing');
  return value;
}

export function CommandPaletteProvider({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const enabled = pathname === '/overview' || pathname === '/app' || pathname.startsWith('/app/');
  const [open, setOpen] = useState(false);
  const [searchContext, setSearchContext] = useState<PaletteSearchContext>({});
  const openRef = useRef(false);
  const restoringFocus = useRef(false);
  const [amountsHidden, setHidden] = useState(true);
  const priorFocus = useRef<HTMLElement | null>(null);
  const openPalette = useCallback((context: PaletteSearchContext = {}) => {
    if (restoringFocus.current || openRef.current) return;
    openRef.current = true;
    setSearchContext(context);
    priorFocus.current = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    setOpen(true);
  }, []);
  const closePalette = useCallback((restoreFocus = true) => {
    openRef.current = false;
    setOpen(false);
    if (!restoreFocus) return;
    requestAnimationFrame(() => {
      restoringFocus.current = true;
      const previous = priorFocus.current;
      const target = previous?.isConnected && !previous.closest('[inert], [aria-hidden="true"]')
        ? previous
        : document.querySelector<HTMLElement>('.venote-mobile-header button[aria-label="Search Venote"]');
      target?.focus({ preventScroll: true });
      queueMicrotask(() => { restoringFocus.current = false; });
    });
  }, []);
  const navigate = useCallback((href: string) => {
    closePalette(false);
    window.dispatchEvent(new Event('venote:close-menu'));
    router.push(href);
    window.dispatchEvent(new CustomEvent('venote:navigate', { detail: href }));
  }, [closePalette, router]);
  const setAmountsHidden = useCallback((hidden: boolean) => {
    setHidden(hidden);
    try { localStorage.setItem('venote_overview_hide_amounts', String(hidden)); } catch {}
  }, []);
  useEffect(() => {
    try { setHidden(localStorage.getItem('venote_overview_hide_amounts') === 'true'); } catch {}
  }, []);
  useEffect(() => {
    if (!enabled) { openRef.current = false; setOpen(false); return; }
    const shortcut = (event: KeyboardEvent) => {
      if (!(event.metaKey || event.ctrlKey) || event.altKey || event.key.toLowerCase() !== 'k' || event.isComposing) return;
      const target = event.target instanceof Element ? event.target : document.activeElement;
      if (target?.closest('.tiptap, .ProseMirror, [contenteditable="true"]')) return;
      event.preventDefault();
      if (open) closePalette(); else openPalette();
    };
    window.addEventListener('keydown', shortcut);
    return () => window.removeEventListener('keydown', shortcut);
  }, [enabled, open, openPalette, closePalette]);
  useEffect(() => {
    const viewport = window.visualViewport;
    let frame = 0;
    let baselineHeight = window.innerHeight;
    let baselineWidth = window.innerWidth;
    const update = () => {
      cancelAnimationFrame(frame);
      frame = requestAnimationFrame(() => {
        const style = document.documentElement.style;
        style.setProperty('--venote-vh', `${viewport?.height || window.innerHeight}px`);
        style.setProperty('--venote-vtop', `${viewport?.offsetTop || 0}px`);
        style.setProperty('--venote-vw', `${viewport?.width || window.innerWidth}px`);
        style.setProperty('--venote-vleft', `${viewport?.offsetLeft || 0}px`);
        const focused = document.activeElement;
        if (window.innerWidth !== baselineWidth) { baselineWidth = window.innerWidth; baselineHeight = window.innerHeight; }
        baselineHeight = Math.max(baselineHeight, window.innerHeight, viewport?.height || 0);
        const keyboardOpen = focused instanceof HTMLElement && focused.matches('input, textarea, [contenteditable="true"]') && (viewport?.height || window.innerHeight) < baselineHeight - 120;
        document.documentElement.dataset.venoteKeyboard = keyboardOpen ? 'open' : 'closed';
        if (enabled && focused instanceof HTMLElement && focused.matches('input, textarea, [contenteditable="true"]')) {
          focused.scrollIntoView({ block: 'nearest', inline: 'nearest', behavior: 'instant' });
        }
      });
    };
    update();
    viewport?.addEventListener('resize', update);
    viewport?.addEventListener('scroll', update);
    window.addEventListener('resize', update);
    document.addEventListener('focusin', update);
    document.addEventListener('focusout', update);
    return () => {
      cancelAnimationFrame(frame);
      viewport?.removeEventListener('resize', update);
      viewport?.removeEventListener('scroll', update);
      window.removeEventListener('resize', update);
      document.removeEventListener('focusin', update);
      document.removeEventListener('focusout', update);
    };
  }, [enabled]);
  return <Context.Provider value={{ openPalette, closePalette, navigate, amountsHidden, setAmountsHidden }}>
    <div className="contents" data-venote-app={enabled ? '' : undefined} inert={open && enabled ? true : undefined}>{children}</div>
    <CommandPalette open={open && enabled} onClose={closePalette} searchContext={searchContext} />
  </Context.Provider>;
}
