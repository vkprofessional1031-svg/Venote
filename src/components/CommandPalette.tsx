'use client';

import { useEffect, useId, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { AnimatePresence, motion, useReducedMotion } from 'framer-motion';
import { supabase } from '@/lib/supabase';
import { useCommands, type PaletteSearchContext } from './CommandPaletteProvider';
import { useTheme } from './ThemeProvider';
import { DelayedSkeleton, GlassSkeletonCard } from './Skeleton';

type SearchItem = { id: string; title: string; snippet: string; createdAt: string; href: string; icon: string };
type Command = { id: string; label: string; group: string; icon: string; hint?: string; snippet?: string; run: () => void };
const pages = [
  ['Organize', '/app', 'entry'], ['Overview', '/overview', 'grid'], ['Quick Notes', '/app/quick-notes', 'note'],
  ['Schedule', '/app/schedule', 'calendar'], ['Wallet', '/app/expenses', 'wallet'], ['Job', '/app/rounds', 'job'],
  ['Settings', '/app/settings', 'settings'], ['Archive', '/app?view=archived', 'archive'], ['Trash', '/app?view=trash', 'trash'],
];

export function fuzzyScore(label: string, query: string) {
  const text = label.toLocaleLowerCase();
  const needle = query.trim().toLocaleLowerCase();
  if (!needle) return 0;
  const exact = text.indexOf(needle);
  if (exact >= 0) return exact / 100;
  let position = 0, score = 1;
  for (const char of needle) {
    const found = text.indexOf(char, position);
    if (found < 0) return Infinity;
    score += found - position;
    position = found + 1;
  }
  return score;
}
function text(value: unknown): string {
  return typeof value === 'string' ? value.replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ').trim() : '';
}
function privateText(value: unknown) {
  return text(value).replace(/(?:[$€£₹¥]|\b(?:USD|EUR|GBP|INR|JPY|AUD|CAD)\s*)\s*[+-]?[\d,.]+|\b[\d,.]+\s*(?:USD|EUR|GBP|INR|JPY|AUD|CAD)\b/gi, '••••');
}
function toItems(row: Record<string, any>, quick: boolean): SearchItem[] {
  if (quick) return [{ id: `quick-${row.id}`, title: privateText(row.title) || 'Untitled quick note', snippet: privateText(row.body).slice(0, 120), createdAt: row.created_at, href: `/app/quick-notes?note=${encodeURIComponent(row.id)}`, icon: 'note' }];
  // Wallet rows and legacy transaction confirmations are deliberately excluded.
  const results = Array.isArray(row.results) ? row.results : [];
  return results.filter((result: Record<string, any>) => ['note', 'tasks', 'table', 'roadmap', 'chat'].includes(result.type)).slice(0, 1).map((result: Record<string, any>) => ({
    id: `entry-${row.id}`, title: privateText(result.title) || 'Untitled entry',
    snippet: privateText(result.type === 'chat' ? '' : result.body || result.goal || result.items?.map((item: Record<string, any>) => item.text).join(' ') || result.columns?.join(' ')).slice(0, 120),
    createdAt: row.created_at, href: `/app?entry=${encodeURIComponent(row.id)}`, icon: 'entry',
  }));
}
export async function searchPaletteItems(userId: string, query: string, signal: AbortSignal, context: PaletteSearchContext = {}): Promise<SearchItem[]> {
  const needle = query.trim().toLocaleLowerCase();
  const limit = needle ? 6 : 5;
  const scan = async (quick: boolean) => {
    const found: SearchItem[] = [];
    for (let offset = 0; found.length < limit; offset += 100) {
      let request = supabase.from(quick ? 'quick_notes' : 'entries')
        .select(quick ? 'id,title,body,created_at' : 'id,results,created_at').eq('user_id', userId);
      request = context.view === 'trash' ? request.not('deleted_at', 'is', null) : request.is('deleted_at', null);
      if (context.view && context.view !== 'trash') request = request.eq('is_archived', context.view === 'archived');
      if (!quick && context.tag) request = request.contains('tags', [context.tag]);
      const { data, error } = await request.order('created_at', { ascending: false }).order('id', { ascending: false }).range(offset, offset + 99).abortSignal(signal);
      if (signal.aborted) return [];
      if (error) throw error;
      for (const row of data || []) {
        for (const item of toItems(row, quick)) {
          if (context.view === 'trash') item.href = quick ? '/app/quick-notes?view=trash' : '/app?view=trash';
          if (!needle || `${item.title} ${item.snippet}`.toLocaleLowerCase().includes(needle)) found.push(item);
          if (found.length === limit) break;
        }
        if (found.length === limit) break;
      }
      if (!data || data.length < 100) break;
    }
    return found;
  };
  const groups = await Promise.all([...(context.scope !== 'quick-notes' ? [scan(false)] : []), ...(context.scope !== 'entries' ? [scan(true)] : [])]);
  return groups.flat().sort((a, b) => Date.parse(b.createdAt) - Date.parse(a.createdAt) || b.id.localeCompare(a.id)).slice(0, limit);
}

function Icon({ name }: { name: string }) {
  const paths: Record<string, string> = {
    entry: 'M4 7h16M4 12h16M4 17h10', grid: 'M3 3h7v7H3zM14 3h7v7h-7zM3 14h7v7H3zM14 14h7v7h-7z',
    note: 'M13 3 4 14h7v7l9-11h-7V3Z', calendar: 'M4 5h16v15H4zM8 3v4m8-4v4M4 10h16',
    wallet: 'M4 6h16v14H4zM15 11h5v5h-5z', job: 'M8 6V3h8v3M3 6h18v14H3zM3 11l9 4 9-4',
    settings: 'M4 7h16M4 17h16M8 4v6m8 4v6', archive: 'M3 4h18v5H3zM5 9v11h14V9M10 13h4',
    trash: 'M3 6h18M9 6V3h6v3M5 6l1 15h12l1-15M10 10v7m4-7v7', plus: 'M12 4v16M4 12h16',
    theme: 'M12 3a9 9 0 1 0 9 9h-9V3Z', eye: 'M2 12s3-7 10-7 10 7 10 7-3 7-10 7S2 12 2 12Zm10-3a3 3 0 1 0 0 6 3 3 0 0 0 0-6Z',
    ask: 'M4 4h16v12H9l-5 4V4Zm4 5h8M8 12h5',
  };
  return <svg aria-hidden="true" className="h-5 w-5 shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round"><path d={paths[name] || paths.entry} /></svg>;
}

export default function CommandPalette({ open, onClose, searchContext }: { open: boolean; onClose: () => void; searchContext: PaletteSearchContext }) {
  const { navigate, amountsHidden, setAmountsHidden } = useCommands();
  const { theme, setTheme } = useTheme();
  const reduced = useReducedMotion();
  const id = useId();
  const inputRef = useRef<HTMLInputElement>(null);
  const selecting = useRef(false);
  const dialogRef = useRef<HTMLDivElement>(null);
  const [query, setQuery] = useState('');
  const [active, setActive] = useState(0);
  const [records, setRecords] = useState<SearchItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(false);
  const [retry, setRetry] = useState(0);
  const [shortcut, setShortcut] = useState('Ctrl K');
  useEffect(() => { setShortcut(/Mac|iPhone|iPad/.test(navigator.platform) ? '⌘K' : 'Ctrl K'); }, []);
  useEffect(() => {
    if (!open) return;
    selecting.current = false;
    setQuery(searchContext.query || ''); setActive(0);
    const focusPalette = () => {
      if (matchMedia('(max-width: 767px), (pointer: coarse)').matches) dialogRef.current?.focus({ preventScroll: true });
      else inputRef.current?.focus({ preventScroll: true });
    };
    const frame = requestAnimationFrame(focusPalette);
    const containFocus = (event: FocusEvent) => {
      if (event.target instanceof Node && !dialogRef.current?.contains(event.target)) focusPalette();
    };
    document.addEventListener('focusin', containFocus);
    return () => { cancelAnimationFrame(frame); document.removeEventListener('focusin', containFocus); };
  }, [open, searchContext]);
  useEffect(() => {
    if (!open) return;
    const controller = new AbortController();
    setRecords([]); setError(false);
    if (query.trim().length === 1) { setLoading(false); return () => controller.abort(); }
    setLoading(true);
    const timer = setTimeout(async () => {
      try {
        const { data, error: authError } = await supabase.auth.getSession();
        if (authError) throw authError;
        if (!data.session) { if (!controller.signal.aborted) setRecords([]); return; }
        const result = await searchPaletteItems(data.session.user.id, query, controller.signal, searchContext);
        if (!controller.signal.aborted) setRecords(result);
      } catch {
        if (!controller.signal.aborted) setError(true);
      } finally {
        if (!controller.signal.aborted) setLoading(false);
      }
    }, 200);
    return () => { clearTimeout(timer); controller.abort(); };
  }, [open, query, retry, searchContext]);

  const commands = useMemo(() => {
    const pageItems: Command[] = pages.map(([label, href, icon]) => ({ id: href, label, group: 'Pages', icon, run: () => navigate(href) }));
    const actions: Command[] = [
      { id: 'new-entry', label: 'New entry', group: 'Actions', icon: 'plus', run: () => navigate('/app?action=new-entry') },
      { id: 'new-quick', label: 'New quick note', group: 'Actions', icon: 'plus', run: () => navigate('/app/quick-notes?action=new-quick-note') },
      ...(['system', 'light', 'dark'] as const).map(value => ({ id: `theme-${value}`, label: `Switch theme: ${value[0].toUpperCase()}${value.slice(1)}`, group: 'Actions', icon: 'theme', hint: theme === value ? 'Current' : undefined, run: () => { setTheme(value); onClose(); } })),
      { id: 'amounts', label: amountsHidden ? 'Show amounts' : 'Hide amounts', group: 'Actions', icon: 'eye', run: () => { setAmountsHidden(!amountsHidden); onClose(); } },
    ];
    const staticItems = [...pageItems, ...actions].map(item => ({ item, score: fuzzyScore(item.label, query) })).filter(({ score }) => Number.isFinite(score)).sort((a, b) => a.score - b.score).map(({ item }) => item);
    // Keep groups contiguous after ranking within each group.
    const result = ['Pages', 'Actions'].flatMap(group => staticItems.filter(item => item.group === group));
    if (query.trim().length !== 1) result.push(...records.map(item => ({ id: item.id, label: item.title, snippet: item.snippet, icon: item.icon, group: query ? 'Notes and entries' : 'Recent', run: () => navigate(item.href) })));
    if (query.trim()) result.push({ id: 'ask', label: `Ask Venote: ${query.trim()}`, group: 'Ask Venote', icon: 'ask', hint: 'Enter', run: () => navigate(`/app?draft=${encodeURIComponent(query.trim())}`) });
    return result;
  }, [query, records, navigate, theme, setTheme, amountsHidden, setAmountsHidden, onClose]);
  const choose = (command?: Command) => {
    if (!command || selecting.current) return;
    selecting.current = true;
    command.run();
  };
  const signature = commands.map(command => command.id).join('|');
  useEffect(() => setActive(0), [signature, query]);
  useEffect(() => { if (open) document.getElementById(`${id}-option-${active}`)?.scrollIntoView({ block: 'nearest' }); }, [active, id, open]);
  if (typeof document === 'undefined') return null;
  return createPortal(<AnimatePresence>{open && <motion.div
    className="venote-command-overlay fixed z-[200] flex justify-center bg-background/70 backdrop-blur-sm"
    initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} transition={{ duration: reduced ? 0 : .12 }}
    onPointerDown={event => { if (event.target === event.currentTarget) onClose(); }}>
    <motion.div ref={dialogRef} tabIndex={-1} role="dialog" aria-modal="true" aria-labelledby={`${id}-title`} data-venote-app="" className="venote-command-dialog glass flex w-full max-w-[640px] min-w-0 flex-col shadow-xl"
      initial={reduced ? false : { scale: .98 }} animate={{ scale: 1 }} exit={reduced ? undefined : { scale: .98 }} transition={{ duration: reduced ? 0 : .12 }}
      onKeyDown={event => {
        if (event.key === 'Escape') { event.preventDefault(); onClose(); }
        if (event.key === 'Tab') {
          const focusable = Array.from(dialogRef.current?.querySelectorAll<HTMLElement>('input, button:not([tabindex="-1"]), [href], [tabindex="0"]') || []).filter(element => !element.hasAttribute('disabled') && element.getClientRects().length);
          const first = focusable[0], last = focusable.at(-1);
          if (document.activeElement === dialogRef.current) { event.preventDefault(); (event.shiftKey ? last : first)?.focus(); }
          else if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last?.focus(); }
          else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first?.focus(); }
        }
        if (event.key === 'ArrowDown' || event.key === 'ArrowUp') { event.preventDefault(); setActive(index => (index + (event.key === 'ArrowDown' ? 1 : -1) + commands.length) % Math.max(1, commands.length)); }
        if (event.key === 'Enter' && !event.nativeEvent.isComposing && event.target === inputRef.current) { event.preventDefault(); choose(commands[active] || commands[0]); }
      }}>
      <h2 id={`${id}-title`} className="sr-only">Search Venote</h2>
      <div className="flex items-center gap-2 border-b border-hairline p-3">
        <Icon name="ask" />
        <input ref={inputRef} value={query} onChange={event => { setQuery(event.target.value); setActive(0); }} role="combobox" aria-label="Search pages, actions, notes and entries" aria-autocomplete="list" aria-expanded="true" aria-controls={`${id}-list`} aria-activedescendant={commands[active] ? `${id}-option-${active}` : undefined} placeholder={searchContext.scope === 'entries' ? 'Search Organize…' : searchContext.scope === 'quick-notes' ? 'Search Quick Notes…' : 'Search Venote…'} className="min-w-0 flex-1 bg-transparent py-2 text-base text-primary-text outline-none placeholder:text-muted-text" />
        <button type="button" onClick={() => onClose()} aria-label="Close search" title="Close search (Esc)" className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl text-muted-text hover:bg-surface-brown/50"><span aria-hidden="true">✕</span></button>
      </div>
      <p className="sr-only" role="status" aria-live="polite">{loading ? 'Searching notes' : `${commands.length} results`}</p>
      <div className="min-h-0 overflow-y-auto overscroll-contain p-2" id={`${id}-list`} role="listbox" aria-label="Search results" aria-busy={loading}>
        {commands.map((command, index) => <div key={command.id} role="presentation">
          {(index === 0 || commands[index - 1].group !== command.group) && <div className="px-3 pb-1 pt-3 text-[10px] font-semibold uppercase tracking-widest text-muted-text">{command.group}</div>}
          <button type="button" id={`${id}-option-${index}`} role="option" aria-selected={active === index} tabIndex={-1} onPointerMove={() => setActive(index)} onClick={() => choose(command)} className={`flex min-h-11 w-full min-w-0 items-center gap-3 rounded-xl border px-3 py-2 text-left text-sm ${active === index ? 'border-primary-accent/30 bg-primary-accent/10 text-primary-accent' : 'border-transparent text-primary-text hover:bg-surface-brown/40'}`}>
            <Icon name={command.icon} /><span className="min-w-0 flex-1"><span className="block truncate">{command.label}</span>{command.snippet && <span className="block truncate text-xs text-muted-text">{command.snippet}</span>}</span>{command.hint && <kbd className="shrink-0 text-[10px] text-muted-text">{command.hint}</kbd>}
          </button>
        </div>)}
        {loading && <DelayedSkeleton label="Searching notes"><div className="space-y-2 px-2 py-3">{[0, 1, 2].map(row => <GlassSkeletonCard key={row} rows={0} className="!rounded-xl !p-3" />)}</div></DelayedSkeleton>}
        {error && <p className="p-3 text-sm text-muted-text">Couldn’t load notes. <button onClick={() => setRetry(value => value + 1)} className="text-primary-accent underline">Retry</button></p>}
        {!loading && !error && query.trim() && commands.length === 1 && commands[0].id === 'ask' && <p className="px-3 py-4 text-sm text-muted-text">No matches. Press Enter to ask Venote.</p>}
      </div>
      <div className="flex shrink-0 flex-wrap justify-between gap-2 border-t border-hairline px-4 py-3 text-[11px] text-muted-text"><span>↑ ↓ Navigate · Enter Select · Esc Close</span><span>{shortcut}</span></div>
    </motion.div>
  </motion.div>}</AnimatePresence>, document.body);
}
