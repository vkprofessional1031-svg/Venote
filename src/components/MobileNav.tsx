'use client';

import Link from 'next/link';
import { motion, useReducedMotion } from 'framer-motion';

const destinations = [
  { target: 'organize', href: '/app', label: 'Organize', path: 'M4 7h16M4 12h16M4 17h10' },
  { target: 'overview', href: '/overview', label: 'Overview', path: 'M3 3h7v7H3zM14 3h7v11h-7zM3 14h7v7H3zM14 18h7m-7 3h7' },
  { target: 'wallet', href: '/app/expenses', label: 'Wallet', path: 'M20 8V5H5a2 2 0 0 0-2 2v12h17V8H5a1 1 0 0 1 0-2m11 6h4v4h-4z' },
  { target: 'job', href: '/app/rounds', label: 'Job tracker', path: 'M8 6V4h8v2M3 11l9 4 9-4M3 6h18v14H3zM12 12v4' },
];

export const MOBILE_NAV_HEIGHT = 56;

export default function MobileNav({ activePath }: { activePath: string }) {
  const reducedMotion = useReducedMotion();
  return (
    <nav aria-label="Mobile navigation" className="venote-bottom-nav md:hidden w-full shrink-0 border-t border-hairline bg-background/80 backdrop-blur-xl">
      <div className="grid h-[var(--venote-bottom-nav-height,56px)] min-w-0 w-full grid-cols-4 items-center justify-items-center">
        {destinations.map(item => {
          const active = activePath === item.href;
          return <Link key={item.target} href={item.href} aria-label={item.label} aria-current={active ? 'page' : undefined}
            className={`flex min-h-12 min-w-12 h-12 w-full items-center justify-center rounded-xl transition-[color,transform] duration-200 active:scale-95 motion-reduce:transition-none motion-reduce:active:scale-100 focus-visible:outline-2 focus-visible:outline-primary-accent focus-visible:outline-offset-[-2px] ${active ? 'text-primary-accent' : 'text-[var(--glass-muted)] hover:text-primary-text'}`}>
            <span data-fly-target={item.target} className="relative flex h-10 w-16 shrink-0 items-center justify-center rounded-full">
              {active && <motion.span aria-hidden="true" layoutId={reducedMotion ? undefined : 'venote-mobile-nav-pill'} initial={false}
                transition={{ duration: reducedMotion ? 0 : .2, ease: 'easeOut' }} className="absolute inset-0 rounded-full bg-primary-accent/15" />}
              <svg aria-hidden="true" className="relative h-6 w-6 shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round"><path d={item.path} /></svg>
            </span>
            <span className="sr-only">{item.label}</span>
          </Link>;
        })}
      </div>
    </nav>
  );
}
