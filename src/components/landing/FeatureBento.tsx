'use client';

import type { MouseEvent } from 'react';
import { motion, useReducedMotion } from 'framer-motion';

function handleSpotlightMove(e: MouseEvent<HTMLElement>) {
  const rect = e.currentTarget.getBoundingClientRect();
  e.currentTarget.style.setProperty('--spot-x', `${e.clientX - rect.left}px`);
  e.currentTarget.style.setProperty('--spot-y', `${e.clientY - rect.top}px`);
}

export default function FeatureBento() {
  const reducedMotion = useReducedMotion();

  return (
    <div className="grid grid-cols-1 md:grid-cols-6 lg:grid-cols-12 gap-5 md:gap-6">
      {/* 1. AI-Powered Structuring — Large Card */}
      <motion.article
        onMouseMove={handleSpotlightMove}
        initial={reducedMotion ? false : { opacity: 0, y: 14 }}
        whileInView={{ opacity: 1, y: 0 }}
        viewport={{ once: true, amount: 0.2 }}
        transition={{ duration: 0.35, ease: 'easeOut' }}
        className="landing-bento-card rounded-[26px] p-6 sm:p-8 flex flex-col justify-between overflow-hidden md:col-span-6 lg:col-span-7"
      >
        <div
          aria-hidden="true"
          className="absolute -top-16 -right-16 w-52 h-52 rounded-full pointer-events-none blur-3xl opacity-30"
          style={{ background: 'radial-gradient(circle, #E8B86D 0%, transparent 70%)' }}
        />

        <div className="relative z-10">
          <div className="flex items-center justify-between gap-3 mb-5">
            <div className="w-12 h-12 rounded-2xl bg-tertiary-accent/15 border border-tertiary-accent/30 flex items-center justify-center text-tertiary-accent shadow-inner">
              <svg aria-hidden="true" xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" />
              </svg>
            </div>
            <span className="font-mono text-[11px] uppercase tracking-wider px-2.5 py-1 rounded-full landing-subcard glass-muted">
              Checklists · Notes · Tables
            </span>
          </div>

          <h3 className="font-serif italic font-bold text-2xl sm:text-3xl mb-3 text-primary-text">
            AI-Powered Structuring
          </h3>
          <p className="glass-muted leading-relaxed text-base">
            Just start typing. Our engine instantly analyzes your input and formats it into actionable checklists, rich contextual notes, or clean data tables.
          </p>
        </div>

        {/* Mini-visual: Raw note splitting into structured glass chips */}
        <div aria-hidden="true" className="relative z-10 mt-6 pt-5 border-t border-[var(--glass-hairline)]">
          <div className="flex items-center justify-between text-[11px] font-mono glass-muted mb-2.5">
            <span>Input: &ldquo;ship v2 docs, Q3 metrics table, meeting recap&rdquo;</span>
            <span className="px-1.5 py-0.5 rounded border border-[var(--glass-hairline)]">Sample</span>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
            {[
              { tag: 'Checklist', title: 'Ship v2 docs', meta: '2 subtasks', color: '#FF5C38' },
              { tag: 'Table', title: 'Q3 Metrics', meta: '3 cols · 4 rows', color: '#E8B86D' },
              { tag: 'Note', title: 'Meeting Recap', meta: 'Formatted', color: '#5BBD8E' },
            ].map((pill, i) => (
              <motion.div
                key={pill.tag}
                initial={reducedMotion ? false : { opacity: 0, y: 8 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ duration: 0.3, delay: reducedMotion ? 0 : 0.1 + i * 0.08 }}
                className="landing-subcard rounded-xl p-3 flex flex-col gap-1"
              >
                <div className="flex items-center justify-between">
                  <span className="font-mono text-[10px] uppercase tracking-wider" style={{ color: pill.color }}>
                    {pill.tag}
                  </span>
                  <span className="w-1.5 h-1.5 rounded-full" style={{ backgroundColor: pill.color }} />
                </div>
                <span className="font-sans text-xs font-semibold text-primary-text truncate">{pill.title}</span>
                <span className="font-mono text-[10px] glass-muted">{pill.meta}</span>
              </motion.div>
            ))}
          </div>
        </div>
      </motion.article>

      {/* 2. Smart Wallet — Medium Card */}
      <motion.article
        onMouseMove={handleSpotlightMove}
        initial={reducedMotion ? false : { opacity: 0, y: 14 }}
        whileInView={{ opacity: 1, y: 0 }}
        viewport={{ once: true, amount: 0.2 }}
        transition={{ duration: 0.35, delay: reducedMotion ? 0 : 0.06, ease: 'easeOut' }}
        className="landing-bento-card rounded-[26px] p-6 sm:p-8 flex flex-col justify-between overflow-hidden md:col-span-6 lg:col-span-5"
      >
        <div
          aria-hidden="true"
          className="absolute -top-16 -right-16 w-48 h-48 rounded-full pointer-events-none blur-3xl opacity-30"
          style={{ background: 'radial-gradient(circle, #5BBD8E 0%, transparent 70%)' }}
        />

        <div className="relative z-10">
          <div className="flex items-center justify-between gap-3 mb-5">
            <div className="w-12 h-12 rounded-2xl bg-secondary-accent/15 border border-secondary-accent/30 flex items-center justify-center text-secondary-accent shadow-inner">
              <svg aria-hidden="true" xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M3 10h18M7 15h1m4 0h1m-7 4h12a3 3 0 003-3V8a3 3 0 00-3-3H6a3 3 0 00-3 3v8a3 3 0 003 3z" />
              </svg>
            </div>
            <span className="font-mono text-[11px] uppercase tracking-wider px-2.5 py-1 rounded-full landing-subcard glass-muted">
              Budgets &amp; Splits
            </span>
          </div>

          <h3 className="font-serif italic font-bold text-2xl sm:text-3xl mb-3 text-primary-text">
            Smart Wallet
          </h3>
          <p className="glass-muted leading-relaxed text-base">
            Set category budgets with visual limits, track split bills to see who owes you what, and get AI-generated summaries of your spending patterns.
          </p>
        </div>

        {/* Mini-visual: Animated Category Bar */}
        <div aria-hidden="true" className="relative z-10 mt-6 pt-5 border-t border-[var(--glass-hairline)] space-y-2.5">
          <div className="flex items-center justify-between text-xs font-mono">
            <span className="text-primary-text font-semibold">Food &amp; Dining · $140 / $200</span>
            <span className="glass-muted text-[10px] px-1.5 py-0.5 rounded border border-[var(--glass-hairline)]">Sample</span>
          </div>
          <div className="h-2.5 w-full rounded-full overflow-hidden landing-subcard flex p-0.5 gap-1">
            <motion.span
              initial={reducedMotion ? { scaleX: 1 } : { scaleX: 0 }}
              whileInView={{ scaleX: 1 }}
              viewport={{ once: true }}
              transition={{ duration: 0.6, ease: 'easeOut' }}
              style={{ transformOrigin: 'left' }}
              className="h-full w-[48%] rounded-full bg-primary-accent"
            />
            <motion.span
              initial={reducedMotion ? { scaleX: 1 } : { scaleX: 0 }}
              whileInView={{ scaleX: 1 }}
              viewport={{ once: true }}
              transition={{ duration: 0.6, delay: reducedMotion ? 0 : 0.12, ease: 'easeOut' }}
              style={{ transformOrigin: 'left' }}
              className="h-full w-[28%] rounded-full bg-secondary-accent"
            />
            <motion.span
              initial={reducedMotion ? { scaleX: 1 } : { scaleX: 0 }}
              whileInView={{ scaleX: 1 }}
              viewport={{ once: true }}
              transition={{ duration: 0.6, delay: reducedMotion ? 0 : 0.22, ease: 'easeOut' }}
              style={{ transformOrigin: 'left' }}
              className="h-full w-[16%] rounded-full bg-tertiary-accent"
            />
          </div>
          <div className="flex items-center justify-between text-[11px] font-mono glass-muted">
            <span>Split: Alex owes $18.50</span>
            <span>receipt OCR ready</span>
          </div>
        </div>
      </motion.article>

      {/* 3. Interview Prep — Medium Card */}
      <motion.article
        onMouseMove={handleSpotlightMove}
        initial={reducedMotion ? false : { opacity: 0, y: 14 }}
        whileInView={{ opacity: 1, y: 0 }}
        viewport={{ once: true, amount: 0.2 }}
        transition={{ duration: 0.35, delay: reducedMotion ? 0 : 0.08, ease: 'easeOut' }}
        className="landing-bento-card rounded-[26px] p-6 sm:p-8 flex flex-col justify-between overflow-hidden md:col-span-6 lg:col-span-6"
      >
        <div
          aria-hidden="true"
          className="absolute -bottom-16 -right-16 w-52 h-52 rounded-full pointer-events-none blur-3xl opacity-30"
          style={{ background: 'radial-gradient(circle, #8B5CF6 0%, transparent 70%)' }}
        />

        <div className="relative z-10">
          <div className="flex items-center justify-between gap-3 mb-5">
            <div className="w-12 h-12 rounded-2xl bg-[#8B5CF6]/15 border border-[#8B5CF6]/35 flex items-center justify-center text-[#8B5CF6] shadow-inner">
              <svg aria-hidden="true" xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M21 13.255A23.931 23.931 0 0112 15c-3.183 0-6.22-.62-9-1.745M16 6V4a2 2 0 00-2-2h-4a2 2 0 00-2 2v2m4 6h.01M5 20h14a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
              </svg>
            </div>
            <span className="font-mono text-[11px] uppercase tracking-wider px-2.5 py-1 rounded-full landing-subcard glass-muted">
              Due Soon View
            </span>
          </div>

          <h3 className="font-serif italic font-bold text-2xl sm:text-3xl mb-3 text-primary-text">
            Interview Prep
          </h3>
          <p className="glass-muted leading-relaxed text-base">
            Track job applications through multiple rounds and see upcoming deadlines in a dedicated &ldquo;Due Soon&rdquo; view. AI automatically parses your updates.
          </p>
        </div>

        {/* Mini-visual: Round Pipeline */}
        <div aria-hidden="true" className="relative z-10 mt-6 pt-5 border-t border-[var(--glass-hairline)]">
          <div className="landing-subcard rounded-xl p-3 flex flex-wrap items-center justify-between gap-2">
            <div className="flex items-center gap-2">
              <span className="w-2 h-2 rounded-full bg-primary-accent" />
              <span className="font-sans text-xs font-semibold text-primary-text">Google · SWE</span>
              <span className="font-mono text-[11px] glass-muted">→ Online Assessment</span>
            </div>
            <div className="flex items-center gap-1.5">
              <span className="font-mono text-[10px] px-2 py-0.5 rounded-full bg-primary-accent/15 border border-primary-accent/35 text-primary-text">
                Due Fri
              </span>
              <span className="font-mono text-[10px] px-1.5 py-0.5 rounded glass-muted border border-[var(--glass-hairline)]">
                Sample
              </span>
            </div>
          </div>
        </div>
      </motion.article>

      {/* 4. Dynamic Roadmaps — Small Card */}
      <motion.article
        onMouseMove={handleSpotlightMove}
        initial={reducedMotion ? false : { opacity: 0, y: 14 }}
        whileInView={{ opacity: 1, y: 0 }}
        viewport={{ once: true, amount: 0.2 }}
        transition={{ duration: 0.35, delay: reducedMotion ? 0 : 0.12, ease: 'easeOut' }}
        className="landing-bento-card rounded-[26px] p-6 flex flex-col justify-between overflow-hidden md:col-span-3 lg:col-span-3"
      >
        <div
          aria-hidden="true"
          className="absolute -top-12 -right-12 w-40 h-40 rounded-full pointer-events-none blur-3xl opacity-25"
          style={{ background: 'radial-gradient(circle, #5BBD8E 0%, transparent 70%)' }}
        />

        <div className="relative z-10">
          <div className="w-11 h-11 rounded-2xl bg-secondary-accent/15 border border-secondary-accent/30 flex items-center justify-center mb-4 text-secondary-accent shadow-inner">
            <svg aria-hidden="true" xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6" />
            </svg>
          </div>
          <h3 className="font-serif italic font-bold text-xl sm:text-2xl mb-2 text-primary-text">
            Dynamic Roadmaps
          </h3>
          <p className="glass-muted leading-relaxed text-sm">
            Need a plan? Ask for a roadmap and watch it generate an interactive, winding SVG journey to help you track milestones toward your final goal.
          </p>
        </div>

        {/* Mini-visual: Connecting SVG Roadmap Nodes */}
        <div aria-hidden="true" className="relative z-10 mt-5 pt-4 border-t border-[var(--glass-hairline)]">
          <svg className="w-full h-11" viewBox="0 0 220 44" fill="none">
            <path
              d="M18 30 C 65 8, 105 38, 150 18 C 175 10, 190 22, 204 14"
              stroke="currentColor"
              className="text-secondary-accent/40"
              strokeWidth="2"
              strokeDasharray="4 4"
            />
            <circle cx="18" cy="30" r="5" fill="#5BBD8E" />
            <circle cx="96" cy="24" r="5" fill="#E8B86D" />
            <circle cx="204" cy="14" r="6" fill="#FF5C38" />
          </svg>
          <div className="flex justify-between font-mono text-[10px] glass-muted">
            <span>Step 1</span>
            <span>Milestone</span>
            <span className="text-primary-text">Goal</span>
          </div>
        </div>
      </motion.article>

      {/* 5. Voice Input — Small Card */}
      <motion.article
        onMouseMove={handleSpotlightMove}
        initial={reducedMotion ? false : { opacity: 0, y: 14 }}
        whileInView={{ opacity: 1, y: 0 }}
        viewport={{ once: true, amount: 0.2 }}
        transition={{ duration: 0.35, delay: reducedMotion ? 0 : 0.16, ease: 'easeOut' }}
        className="landing-bento-card rounded-[26px] p-6 flex flex-col justify-between overflow-hidden md:col-span-3 lg:col-span-3"
      >
        <div
          aria-hidden="true"
          className="absolute -bottom-12 -right-12 w-40 h-40 rounded-full pointer-events-none blur-3xl opacity-25"
          style={{ background: 'radial-gradient(circle, #FF5C38 0%, transparent 70%)' }}
        />

        <div className="relative z-10">
          <div className="w-11 h-11 rounded-2xl bg-primary-accent/15 border border-primary-accent/30 flex items-center justify-center mb-4 text-primary-accent shadow-inner">
            <svg aria-hidden="true" xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M19 11a7 7 0 01-7 7m0 0a7 7 0 01-7-7m7 7v4m0 0H8m4 0h4m-4-8a3 3 0 01-3-3V5a3 3 0 116 0v6a3 3 0 01-3 3z" />
            </svg>
          </div>
          <h3 className="font-serif italic font-bold text-xl sm:text-2xl mb-2 text-primary-text">
            Voice Input
          </h3>
          <p className="glass-muted leading-relaxed text-sm">
            Sometimes typing is too slow. Use our built-in speech recognition to instantly transcribe your brainstorms right into the app.
          </p>
        </div>

        {/* Mini-visual: Waveform Bars */}
        <div aria-hidden="true" className="relative z-10 mt-5 pt-4 border-t border-[var(--glass-hairline)] flex items-center justify-between gap-2">
          <div className="flex items-center gap-1 h-8">
            {[0.45, 0.85, 0.6, 1, 0.5, 0.9, 0.65, 0.4, 0.75, 0.55].map((scale, i) => (
              <motion.span
                key={i}
                initial={{ scaleY: scale }}
                animate={
                  reducedMotion
                    ? { scaleY: scale }
                    : { scaleY: [scale, Math.min(1, scale + 0.3), scale] }
                }
                transition={{
                  duration: 1.4,
                  repeat: reducedMotion ? 0 : Infinity,
                  delay: i * 0.09,
                  ease: 'easeInOut',
                }}
                className="w-1.5 h-6 rounded-full bg-primary-accent/80 inline-block"
              />
            ))}
          </div>
          <span className="font-mono text-[10px] px-2 py-0.5 rounded-full landing-subcard glass-muted">
            Voice → Text
          </span>
        </div>
      </motion.article>
    </div>
  );
}

