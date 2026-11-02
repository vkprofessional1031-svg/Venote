'use client';

import { Skeleton, DelayedSkeleton } from '@/components/Skeleton';
import { useEffect, useState, type ReactNode } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { motion, useReducedMotion } from 'framer-motion';
import type { Session } from '@supabase/supabase-js';
import { supabase } from '@/lib/supabase';
import { getCurrencySymbolFromLocale } from '@/lib/currency';
import { monthBounds, toLocalYMD } from '@/utils/date';
import AppSidebar from '@/components/AppSidebar';
import AppMobileHeader from '@/components/AppMobileHeader';
import MobileNav from '@/components/MobileNav';
import { useCommands } from '@/components/CommandPaletteProvider';

type Row = Record<string, any>;
// Paginate reads so totals and task counts are not silently capped by PostgREST.
async function rows(table: string, columns: string, userId: string, configure: (query: any) => any = q => q) {
  const result: Row[] = [];
  for (let offset = 0; ; offset += 500) {
    const { data, error } = await configure(supabase.from(table).select(columns).eq('user_id', userId)).order('id').range(offset, offset + 499);
    if (error) throw error;
    result.push(...(data || []));
    if (!data || data.length < 500) return result;
  }
}
const entries = (id: string) => rows('entries', 'id, results, created_at', id, q => q.is('deleted_at', null).eq('is_archived', false));
const upcoming = (id: string) => rows('application_rounds', 'id, deadline, round_name, job_applications(company)', id, q => q.eq('status', 'upcoming').gte('deadline', new Date().toISOString())).then(data => data.sort((a, b) => Date.parse(a.deadline) - Date.parse(b.deadline)));
const plain = (text: string = '') => text.replace(/<[^>]*>/g, ' ').replace(/[#*_`\[\]]/g, '').replace(/\s+/g, ' ').trim();
const dateLabel = (date: string) => new Date(date).toLocaleString(undefined, { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' });
const example = (text: string) => `/app?draft=${encodeURIComponent(text)}`;

function Card({ userId, title, href, prompt, load, children, index, className = '' }: { userId: string; title: string; href: string; prompt: string; load: (id: string) => Promise<Row>; children: (data: Row) => ReactNode; index: number; className?: string }) {
  const [state, setState] = useState<{ data?: Row; error?: boolean }>({});
  const [retry, setRetry] = useState(0);
  const reduced = useReducedMotion();
  useEffect(() => {
    let active = true;
    setState({});
    load(userId).then(data => { if (active) setState({ data }); }).catch(() => { if (active) setState({ error: true }); });
    return () => { active = false; };
  }, [userId, load, retry]);
  return <motion.section initial={reduced ? false : { opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: .18, delay: reduced ? 0 : index * .04 }} className={`glass p-5 min-w-0 min-h-[280px] h-full flex flex-col ${className}`} aria-label={title}>
    <div className="flex justify-between items-center gap-4 mb-4"><h2 className="font-serif italic font-bold text-xl text-primary-text">{title}</h2><Link className="glass-link text-xs whitespace-nowrap" href={href}>View all<span className="sr-only"> {title}</span> →</Link></div>
    {!state.data && !state.error ? <DelayedSkeleton label={`Loading ${title}`}><div className="space-y-3">{[0, 1, 2, 3].map(n => <Skeleton key={n} className="h-6 w-full" />)}</div></DelayedSkeleton> : state.error ? <div className="text-sm text-muted-text space-y-2"><p>Couldn’t load this card.</p><button onClick={() => setRetry(n => n + 1)} className="glass-link">Try again</button></div> : state.data?.empty ? <div className="text-sm text-muted-text space-y-3"><p>Nothing here yet.</p><Link className="glass-link block" href={example(prompt)}>Try: {prompt}</Link><p>Your saved items will appear here.</p></div> : <div className="text-sm space-y-3 venote-content-enter">{children(state.data!)}</div>}
  </motion.section>;
}

async function loadToday(id: string) {
  const now = new Date(); const today = toLocalYMD(now);
  const tomorrow = new Date(now); tomorrow.setDate(now.getDate() + 1); tomorrow.setHours(0, 0, 0, 0);
  const start = new Date(now); start.setHours(0, 0, 0, 0);
  const [notes, blocks, rounds] = await Promise.all([entries(id), rows('schedule_blocks', 'id, title, start_time', id, q => q.gte('start_time', start.toISOString()).lt('start_time', tomorrow.toISOString())), upcoming(id)]);
  const items: { text: string; time: number; label: string; href: string }[] = [];
  notes.forEach(entry => (entry.results || []).forEach((result: Row) => {
    if (result.type === 'tasks') (result.items || []).forEach((task: Row) => {
      if (!task.done && task.dueDate?.slice(0, 10) === today) items.push({ text: task.text, time: start.getTime(), label: 'Due today', href: '/app' });
    });
  }));
  blocks.forEach(block => items.push({ text: block.title, time: Date.parse(block.start_time), label: dateLabel(block.start_time), href: '/app/schedule' }));
  if (rounds[0]) items.push({ text: `${rounds[0].job_applications?.company || 'Interview'} · ${rounds[0].round_name}`, time: Date.parse(rounds[0].deadline), label: dateLabel(rounds[0].deadline), href: '/app/rounds' });
  items.sort((a, b) => a.time - b.time);
  const preview = items.slice(0, 3);
  const nextRound = items.find(item => item.href === '/app/rounds');
  if (nextRound && !preview.includes(nextRound)) preview.splice(2, 1, nextRound);
  return { items: preview, count: items.length, empty: !items.length };
}
async function loadWallet(id: string) {
  const [start, end] = monthBounds(new Date());
  const filter = (q: any) => q.gte('date', start).lt('date', end);
  const [spentRows, earnedRows, settings] = await Promise.all([rows('expenses', 'id, amount, category', id, filter), rows('income', 'id, amount', id, filter), supabase.from('user_settings').select('currency').eq('user_id', id).maybeSingle()]);
  if (settings.error) throw settings.error;
  const symbols: Record<string, string> = { USD: '$', EUR: '€', GBP: '£', INR: '₹', JPY: '¥', AUD: 'A$', CAD: 'C$' };
  const categories: Record<string, number> = {};
  spentRows.forEach(row => { categories[row.category || 'Other'] = (categories[row.category || 'Other'] || 0) + Number(row.amount); });
  return { spent: spentRows.reduce((n, row) => n + Number(row.amount), 0), earned: earnedRows.reduce((n, row) => n + Number(row.amount), 0), categories: Object.entries(categories).sort((a, b) => b[1] - a[1]), symbol: settings.data?.currency ? symbols[settings.data.currency] || '$' : getCurrencySymbolFromLocale(), empty: !spentRows.length && !earnedRows.length };
}
async function loadJobs(id: string) {
  const [apps, rounds] = await Promise.all([rows('job_applications', 'id, status', id), upcoming(id)]);
  return { counts: ['applied', 'in_progress', 'accepted', 'rejected'].map(status => ({ status, count: apps.filter(app => app.status?.toLowerCase() === status).length })), next: rounds[0], empty: !apps.length && !rounds.length };
}
async function loadNotes(id: string) {
  const data = await entries(id);
  const notes = data.sort((a, b) => Date.parse(b.created_at) - Date.parse(a.created_at)).flatMap(entry => (entry.results || []).filter((r: Row) => r.type === 'note').map((r: Row) => ({ ...r, id: entry.id }))).slice(0, 3);
  return { notes, empty: !notes.length };
}
async function loadQuick(id: string) {
  const [notes, organized] = await Promise.all([rows('quick_notes', 'id, title, body, created_at', id, q => q.is('deleted_at', null).eq('is_archived', false)), entries(id)]);
  const start = new Date(); start.setDate(start.getDate() - ((start.getDay() + 6) % 7)); start.setHours(0, 0, 0, 0);
  const end = new Date(start); end.setDate(end.getDate() + 7);
  const tasks = organized.flatMap(entry => (entry.results || []).filter((r: Row) => r.type === 'tasks').flatMap((r: Row) => (r.items || []).filter((task: Row) => !task.done && task.dueDate && Date.parse(`${task.dueDate.slice(0, 10)}T12:00:00`) >= start.getTime() && Date.parse(`${task.dueDate.slice(0, 10)}T12:00:00`) < end.getTime())));
  return { notes: notes.sort((a, b) => Date.parse(b.created_at) - Date.parse(a.created_at)).slice(0, 2), total: notes.length, due: tasks.length, empty: !notes.length && !tasks.length };
}

export default function Overview() {
  const router = useRouter();
  const [session, setSession] = useState<Session | null>(null);
  const [menu, setMenu] = useState(false);
  const { amountsHidden: hidden, setAmountsHidden: setHidden } = useCommands();
  const [now, setNow] = useState<Date | null>(null);
  useEffect(() => {
    setNow(new Date());
    supabase.auth.getSession().then(({ data }) => { setSession(data.session); if (!data.session) router.replace('/login'); });
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, next) => { setSession(next); if (!next) router.replace('/login'); });
    return () => subscription.unsubscribe();
  }, [router]);
  const toggle = () => setHidden(!hidden);
  const name = session?.user.user_metadata?.name?.split(' ')[0] || session?.user.user_metadata?.full_name?.split(' ')[0];
  return <div className="venote-page h-dvh flex bg-background text-primary-text overflow-hidden">
    <AppSidebar activePath="/overview" isMobileMenuOpen={menu} onCloseMenu={() => setMenu(false)} session={session} />
    <div className="flex-1 min-h-0 flex flex-col min-w-0">
      <AppMobileHeader onOpenMenu={() => setMenu(true)} />
      <main className="flex-1 min-h-0 overflow-y-auto p-4 md:p-8 lg:p-10"><div className="max-w-6xl mx-auto">
        <header className="flex items-center justify-between gap-4 mb-8"><div><p className="text-sm text-muted-text mb-1">{now?.toLocaleDateString(undefined, { weekday: 'long', month: 'long', day: 'numeric' }) || 'Today'}</p><h1 className="font-serif italic font-bold text-4xl md:text-[40px] tracking-tight leading-[1.1] text-primary-text mb-3">{now && now.getHours() < 12 ? 'Good morning' : now && now.getHours() < 18 ? 'Good afternoon' : 'Good evening'}{name ? `, ${name}` : ''}</h1><p className="text-muted-text text-sm mt-2">Your overview, at a glance.</p></div>
          <button onClick={toggle} aria-label={hidden ? 'Show amounts' : 'Hide amounts'} aria-pressed={hidden} className="glass-chip px-3 py-2 text-sm flex items-center gap-2"><svg aria-hidden="true" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5"><path d="M2 12s3-7 10-7 10 7 10 7-3 7-10 7S2 12 2 12Z"/><circle cx="12" cy="12" r="3"/>{hidden && <path d="m3 3 18 18"/>}</svg><span className="hidden sm:inline">{hidden ? 'Show amounts' : 'Hide amounts'}</span></button>
        </header>
        {session && <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 items-stretch">
          <Card userId={session.user.id} title="Today" href="/app/today" prompt="Remind me to buy milk today" load={loadToday} index={0}>{data => <>{data.items.map((item: Row, i: number) => <Link key={i} href={item.href} className="flex justify-between gap-3"><span className="truncate">{item.text}</span><span className="text-muted-text text-xs shrink-0">{item.label}</span></Link>)}<p className="text-muted-text text-xs">{data.count} items to keep in view</p></>}</Card>
          <Card userId={session.user.id} title="Wallet" href="/app/expenses" prompt="spent 20 on lunch" load={loadWallet} index={1}>{data => {
            const money = (amount: number) => hidden ? '••••' : `${amount < 0 ? '-' : ''}${data.symbol}${Math.abs(amount).toFixed(2)}`;
            return <>{[['Spent', data.spent], ['Earned', data.earned], ['Balance', data.earned - data.spent]].map(([label, amount]) => <p key={label} className="flex justify-between"><span className="text-muted-text">{label}</span><span className="font-serif italic font-bold text-2xl tabular-nums">{money(amount)}</span></p>)}<div className="flex gap-1 h-2 rounded-full overflow-hidden" aria-hidden="true">{data.categories.map(([category, amount]: [string, number], i: number) => <span key={category} className={i % 3 === 0 ? 'bg-primary-accent' : i % 3 === 1 ? 'bg-secondary-accent' : 'bg-tertiary-accent'} style={{ flex: hidden ? 1 : Math.max(0, amount) }} />)}</div><p className="text-xs text-muted-text truncate">{hidden ? 'Category amounts hidden' : data.categories.slice(0, 3).map(([name]: [string]) => name).join(' · ')} · This month</p></>;
          }}</Card>
          <Card userId={session.user.id} title="Jobs" href="/app/rounds" prompt="Google OA due Friday" load={loadJobs} index={2}>{data => <>{data.counts.map((item: Row) => <p key={item.status} className="flex justify-between"><span className="text-muted-text capitalize">{item.status.replace('_', ' ')}</span><span className="font-serif italic font-bold text-2xl tabular-nums">{item.count}</span></p>)}<p className="text-xs text-muted-text truncate">{data.next ? `${data.next.job_applications?.company || 'Interview'} · ${data.next.round_name} · ${dateLabel(data.next.deadline)}` : 'No upcoming rounds'}</p></>}</Card>
          <Card userId={session.user.id} title="Recent notes" href="/app" prompt="Note: ideas for my next project" load={loadNotes} index={3} className="lg:col-span-2">{data => <>{data.notes.map((note: Row, i: number) => <Link href="/app" key={`${note.id}-${i}`} className="block truncate"><span className="font-medium">{plain(note.title) || 'Untitled'}</span><span className="text-muted-text"> · {plain(note.body).slice(0, 100) || 'No preview'}</span></Link>)}</>}</Card>
          <Card userId={session.user.id} title="Quick Notes" href="/app/quick-notes" prompt="Note: ideas for my next project" load={loadQuick} index={4}>{data => <><p className="text-muted-text">{data.due} tasks due this week</p>{data.notes.map((note: Row) => <Link key={note.id} href="/app/quick-notes" className="block truncate">{plain(note.title) || plain(note.body).slice(0, 80) || 'Untitled note'}</Link>)}<Link href="/app/quick-notes" className="glass-link block text-xs">{data.total} quick notes →</Link></>}</Card>
        </div>}
      </div></main><MobileNav activePath="/overview" />
    </div>
  </div>;
}
