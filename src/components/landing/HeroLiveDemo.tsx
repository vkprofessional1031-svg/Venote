'use client';

import { useState, type FormEvent } from 'react';
import Link from 'next/link';
import { AnimatePresence, motion, useReducedMotion } from 'framer-motion';
import { classifyDemoInput, type ClassifiedDemoResult, type DemoCategory } from './demoClassifier';

const EXAMPLE_CHIPS = [
  'spent 20 on lunch',
  'Google OA due Friday',
  'buy milk and plan launch post',
] as const;

const CATEGORY_META: Record<
  DemoCategory,
  { accent: string; badgeClass: string; chipSymbol: string }
> = {
  wallet: {
    accent: '#5BBD8E',
    badgeClass: 'border-secondary-accent/40 bg-secondary-accent/15 text-primary-text',
    chipSymbol: '$',
  },
  job: {
    accent: '#8B5CF6',
    badgeClass: 'border-[#8B5CF6]/40 bg-[#8B5CF6]/15 text-primary-text',
    chipSymbol: '▣',
  },
  ask: {
    accent: '#E8B86D',
    badgeClass: 'border-tertiary-accent/40 bg-tertiary-accent/15 text-primary-text',
    chipSymbol: '?',
  },
  tasks: {
    accent: '#FF5C38',
    badgeClass: 'border-primary-accent/40 bg-primary-accent/15 text-primary-text',
    chipSymbol: '✓',
  },
  note: {
    accent: '#FF5C38',
    badgeClass: 'border-primary-accent/35 bg-primary-accent/10 text-primary-text',
    chipSymbol: '≡',
  },
};

function CategoryIcon({ kind }: { kind: DemoCategory }) {
  if (kind === 'wallet') {
    return (
      <svg aria-hidden="true" className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
        <path strokeLinecap="round" strokeLinejoin="round" d="M3 10h18M7 15h1m4 0h1m-7 4h12a3 3 0 003-3V8a3 3 0 00-3-3H6a3 3 0 00-3 3v8a3 3 0 003 3z" />
      </svg>
    );
  }
  if (kind === 'job') {
    return (
      <svg aria-hidden="true" className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
        <path strokeLinecap="round" strokeLinejoin="round" d="M8 6V4h8v2M3 11l9 4 9-4M3 6h18v14H3z" />
      </svg>
    );
  }
  if (kind === 'ask') {
    return (
      <svg aria-hidden="true" className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
        <path strokeLinecap="round" strokeLinejoin="round" d="M8 10h.01M12 10h.01M16 10h.01M21 12c0 4.418-4.03 8-9 8a9.86 9.86 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
      </svg>
    );
  }
  if (kind === 'tasks') {
    return (
      <svg aria-hidden="true" className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
        <path strokeLinecap="round" strokeLinejoin="round" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
      </svg>
    );
  }
  return (
    <svg aria-hidden="true" className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <path strokeLinecap="round" strokeLinejoin="round" d="M4 7h16M4 12h16M4 17h10" />
    </svg>
  );
}

export default function HeroLiveDemo() {
  const reducedMotion = useReducedMotion();
  const [inputValue, setInputValue] = useState<string>(EXAMPLE_CHIPS[0]);
  const [result, setResult] = useState<ClassifiedDemoResult>(() => classifyDemoInput(EXAMPLE_CHIPS[0]));
  const [runKey, setRunKey] = useState<number>(0);
  const [flightChip, setFlightChip] = useState<{
    id: number;
    label: string;
    kind: DemoCategory;
  } | null>(null);

  const triggerClassify = (rawText: string) => {
    const next = classifyDemoInput(rawText);
    const nextKey = Date.now();
    setResult(next);
    setRunKey((k) => k + 1);

    if (!reducedMotion) {
      setFlightChip({
        id: nextKey,
        label: next.headline,
        kind: next.kind,
      });
    }
  };

  const handleSubmit = (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    triggerClassify(inputValue);
  };

  const handleChipClick = (chipText: string) => {
    setInputValue(chipText);
    triggerClassify(chipText);
  };

  const meta = CATEGORY_META[result.kind];

  return (
    <div
      aria-label="Try Venote live in your browser"
      className="w-full max-w-4xl mx-auto mt-2 mb-10"
    >
      <div className="landing-glass-shell rounded-[28px] p-4 sm:p-6 md:p-7 relative overflow-hidden text-left">
        {/* Top bar */}
        <div className="flex flex-wrap items-center justify-between gap-2 mb-3.5">
          <div className="flex items-center gap-2">
            <span className="inline-block w-2 h-2 rounded-full bg-primary-accent" aria-hidden="true" />
            <span className="font-mono text-[11px] uppercase tracking-wider glass-muted">
              Try It Live · Client-Side Routing
            </span>
          </div>
          <span className="font-mono text-[11px] uppercase tracking-wider px-2.5 py-0.5 rounded-full landing-subcard glass-muted">
            Demo
          </span>
        </div>

        {/* Real Interactive Glass Input Form */}
        <form onSubmit={handleSubmit} className="relative" noValidate>
          <label htmlFor="venote-live-demo-input" className="sr-only">
            Type a thought, expense, job update, task, or question (up to 200 characters)
          </label>
          <div className="landing-subcard rounded-2xl p-2 sm:px-3.5 sm:py-2.5 flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-2.5 border border-[var(--glass-border)] focus-within:border-primary-accent/60 transition-colors">
            <div className="flex items-center gap-3 min-w-0 flex-1 pl-2 sm:pl-1">
              <span
                aria-hidden="true"
                className="w-9 h-9 rounded-xl bg-primary-accent/15 border border-primary-accent/35 flex items-center justify-center text-primary-accent shrink-0"
              >
                <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M12 3l2.2 6.8L21 12l-6.8 2.2L12 21l-2.2-6.8L3 12l6.8-2.2L12 3z" />
                </svg>
              </span>
              <input
                id="venote-live-demo-input"
                type="text"
                maxLength={200}
                value={inputValue}
                onChange={(e) => setInputValue(e.target.value.slice(0, 200))}
                placeholder="Type an expense, interview round, task, or question…"
                autoComplete="off"
                className="w-full min-w-0 min-h-[44px] bg-transparent outline-none font-sans text-base text-primary-text placeholder:text-[var(--glass-muted)]"
              />
            </div>

            <div className="flex items-center justify-between sm:justify-end gap-2 shrink-0">
              <span className="font-mono text-[11px] glass-muted pl-2 sm:pl-0" aria-hidden="true">
                {inputValue.length}/200
              </span>
              <button
                type="submit"
                className="min-h-[44px] px-5 py-2 rounded-xl bg-primary-accent text-white font-sans font-semibold text-sm hover:brightness-110 active:scale-95 transition-all shadow-sm focus-visible:outline-2 focus-visible:outline-primary-accent focus-visible:outline-offset-2 cursor-pointer"
              >
                Organize ↵
              </button>
            </div>
          </div>
        </form>

        {/* 3 Tappable Example Chips */}
        <div className="flex flex-wrap items-center gap-2 mt-3" role="group" aria-label="Example inputs">
          <span className="font-mono text-[11px] uppercase tracking-wider glass-muted mr-1">
            Try:
          </span>
          {EXAMPLE_CHIPS.map((chip) => {
            const active = inputValue.trim().toLowerCase() === chip.toLowerCase();
            return (
              <button
                key={chip}
                type="button"
                onClick={() => handleChipClick(chip)}
                aria-pressed={active}
                className={`min-h-[44px] px-3.5 py-2 rounded-full font-mono text-xs transition-colors flex items-center gap-2 border cursor-pointer focus-visible:outline-2 focus-visible:outline-primary-accent ${
                  active
                    ? 'bg-primary-accent/15 border-primary-accent/55 text-primary-text font-semibold'
                    : 'landing-subcard glass-muted hover:text-primary-text'
                }`}
              >
                <span>&ldquo;{chip}&rdquo;</span>
              </button>
            );
          })}
        </div>

        {/* Fly-to-Destination Chip Animation (under 0.8s, transform + opacity only) */}
        <div aria-hidden="true" className="relative h-4 pointer-events-none overflow-visible">
          <AnimatePresence>
            {flightChip && !reducedMotion && (
              <motion.div
                key={flightChip.id}
                initial={{ opacity: 0, y: -22, scale: 0.92 }}
                animate={{
                  opacity: [0, 1, 1, 0],
                  y: [-22, -4, 18, 26],
                  scale: [0.92, 1, 0.9, 0.82],
                }}
                exit={{ opacity: 0 }}
                transition={{ duration: 0.56, times: [0, 0.28, 0.75, 1], ease: 'easeOut' }}
                onAnimationComplete={() =>
                  setFlightChip((current) => (current?.id === flightChip.id ? null : current))
                }
                className="absolute left-1/2 -translate-x-1/2 top-0 z-20"
              >
                <div className="glass-chip px-3 py-1 rounded-full flex items-center gap-1.5 text-xs font-mono text-primary-text whitespace-nowrap shadow-md">
                  <span style={{ color: CATEGORY_META[flightChip.kind].accent }}>
                    {CATEGORY_META[flightChip.kind].chipSymbol}
                  </span>
                  <span className="max-w-[200px] truncate">{flightChip.label}</span>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        {/* Live Result Glass Card (aria-live="polite") */}
        <div aria-live="polite" aria-atomic="true" className="mt-1">
          <motion.div
            key={runKey}
            initial={reducedMotion ? false : { opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: reducedMotion ? 0 : 0.26, ease: 'easeOut' }}
            className="landing-subcard rounded-2xl p-4 sm:p-5 border border-primary-accent/35"
          >
            {/* Card Header */}
            <div className="flex flex-wrap items-center justify-between gap-2 pb-3.5 border-b border-[var(--glass-hairline)]">
              <div className="flex items-center gap-2.5 min-w-0">
                <span
                  aria-hidden="true"
                  className="w-8 h-8 rounded-xl flex items-center justify-center shrink-0"
                  style={{
                    backgroundColor: `${meta.accent}22`,
                    color: meta.accent,
                    border: `1px solid ${meta.accent}55`,
                  }}
                >
                  <CategoryIcon kind={result.kind} />
                </span>
                <div className="min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="font-mono text-xs font-bold uppercase tracking-wider text-primary-text">
                      {result.typeLabel} Card
                    </span>
                    <span className={`font-mono text-[10px] px-2.5 py-0.5 rounded-full border ${meta.badgeClass}`}>
                      {result.statusChip}
                    </span>
                  </div>
                  <p className="font-sans font-bold text-base sm:text-lg text-primary-text mt-0.5 truncate">
                    {result.headline}
                  </p>
                </div>
              </div>

              <span className="font-mono text-[10px] uppercase tracking-wider px-2 py-0.5 rounded border border-[var(--glass-hairline)] glass-muted shrink-0">
                Demo
              </span>
            </div>

            {/* Parsed Fields or Task Items */}
            <div className="mt-3.5">
              {result.tasks && result.tasks.length > 0 ? (
                <div className="space-y-2">
                  <ul className="grid grid-cols-1 sm:grid-cols-2 gap-2" aria-label="Parsed tasks">
                    {result.tasks.map((task, idx) => (
                      <li
                        key={`${task}-${idx}`}
                        className="flex items-center gap-2.5 px-3 py-2 rounded-xl bg-[var(--glass-bg-nested)] border border-[var(--glass-hairline)] text-sm text-primary-text"
                      >
                        <span
                          aria-hidden="true"
                          className="w-4 h-4 rounded border border-primary-accent/60 flex items-center justify-center text-[10px] text-primary-accent shrink-0"
                        >
                          ✓
                        </span>
                        <span className="truncate">{task}</span>
                      </li>
                    ))}
                  </ul>
                  <div className="flex flex-wrap gap-4 pt-1 text-xs font-mono glass-muted">
                    {result.fields.map((f) => (
                      <span key={f.label}>
                        <strong className="text-primary-text">{f.label}:</strong> {f.value}
                      </span>
                    ))}
                  </div>
                </div>
              ) : (
                <dl className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
                  {result.fields.map((field) => (
                    <div
                      key={field.label}
                      className={`rounded-xl px-3.5 py-2.5 bg-[var(--glass-bg-nested)] border border-[var(--glass-hairline)] ${
                        result.fields.length === 2 && field.label === 'Answer' ? 'sm:col-span-2' : ''
                      }`}
                    >
                      <dt className="font-mono text-[10px] uppercase tracking-wider glass-muted">
                        {field.label}
                      </dt>
                      <dd className="font-sans text-sm font-semibold text-primary-text mt-0.5 break-words">
                        {field.value}
                      </dd>
                    </div>
                  ))}
                </dl>
              )}
            </div>

            {/* Required Preview Notice + Sign-in CTA */}
            <div className="mt-4 pt-3 border-t border-[var(--glass-hairline)] flex flex-col sm:flex-row sm:items-center justify-between gap-2 text-xs">
              <p className="glass-muted">
                This is a preview. Sign in to save and ask about your real data.
              </p>
              <Link
                href="/login"
                className="min-h-[44px] sm:min-h-0 inline-flex items-center gap-1 font-mono font-semibold glass-link hover:underline shrink-0 focus-visible:outline-2 focus-visible:outline-primary-accent rounded"
              >
                <span>Sign in to save</span>
                <span aria-hidden="true">→</span>
              </Link>
            </div>
          </motion.div>
        </div>
      </div>
    </div>
  );
}
