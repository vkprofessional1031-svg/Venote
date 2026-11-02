'use client';

import { motion, useReducedMotion } from 'framer-motion';

const STEPS = [
  {
    step: '01',
    title: 'Dump',
    chip: 'Raw thought',
    description:
      'Type or speak anything on your mind—messy tasks, quick expenses, interview rounds, or brainstorm notes.',
    color: '#FF5C38',
  },
  {
    step: '02',
    title: 'Sorted',
    chip: 'Auto-routed',
    description:
      'Venote turns your input into structured checklists, tables, roadmaps, Wallet transactions, or Job updates.',
    color: '#E8B86D',
  },
  {
    step: '03',
    title: 'Ask',
    chip: 'Instant recall',
    description:
      'Ask plain-English questions across your notes, spending, and schedule whenever you need answers.',
    color: '#8B5CF6',
  },
];

export default function HowItWorks() {
  const reducedMotion = useReducedMotion();

  return (
    <section
      id="how-it-works"
      aria-labelledby="how-it-works-heading"
      className="scroll-mt-24 py-20 md:py-24 px-4 sm:px-6 md:px-12 relative"
    >
      <div className="max-w-6xl mx-auto">
        <div className="text-center mb-12 md:mb-16">
          <span className="font-mono text-xs uppercase tracking-widest px-3 py-1 rounded-full landing-subcard glass-muted inline-block mb-3">
            How it works
          </span>
          <h2
            id="how-it-works-heading"
            className="font-serif italic font-bold text-3xl sm:text-4xl md:text-5xl tracking-tight text-primary-text"
          >
            From messy dump to clear answers.
          </h2>
        </div>

        <div className="relative">
          {/* Connecting thin line that draws on scroll (desktop) */}
          <div
            aria-hidden="true"
            className="hidden md:block absolute top-1/2 left-[12%] right-[12%] -translate-y-1/2 h-[2px] pointer-events-none z-0"
          >
            <svg className="w-full h-4 overflow-visible" viewBox="0 0 800 16" fill="none" preserveAspectRatio="none">
              <line
                x1="0"
                y1="8"
                x2="800"
                y2="8"
                stroke="currentColor"
                className="text-primary-text/10"
                strokeWidth="1.5"
              />
              <motion.line
                x1="0"
                y1="8"
                x2="800"
                y2="8"
                stroke="url(#venoteStepGradient)"
                strokeWidth="2"
                initial={reducedMotion ? { pathLength: 1 } : { pathLength: 0 }}
                whileInView={{ pathLength: 1 }}
                viewport={{ once: true, amount: 0.4 }}
                transition={{ duration: 0.9, ease: 'easeOut' }}
              />
              <defs>
                <linearGradient id="venoteStepGradient" x1="0" y1="0" x2="800" y2="0" gradientUnits="userSpaceOnUse">
                  <stop offset="0%" stopColor="#FF5C38" />
                  <stop offset="50%" stopColor="#E8B86D" />
                  <stop offset="100%" stopColor="#8B5CF6" />
                </linearGradient>
              </defs>
            </svg>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-5 md:gap-7 relative z-10">
            {STEPS.map((item, idx) => (
              <motion.div
                key={item.title}
                initial={reducedMotion ? false : { opacity: 0, y: 16 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true, amount: 0.25 }}
                transition={{ duration: 0.35, delay: reducedMotion ? 0 : idx * 0.12, ease: 'easeOut' }}
                className="landing-bento-card rounded-[24px] p-6 sm:p-7 flex flex-col justify-between"
              >
                <div>
                  <div className="flex items-center justify-between gap-2 mb-4">
                    <span
                      className="font-mono text-xs font-bold px-2.5 py-1 rounded-lg border"
                      style={{
                        color: item.color,
                        borderColor: `${item.color}55`,
                        backgroundColor: `${item.color}18`,
                      }}
                    >
                      {item.step}
                    </span>
                    <span className="font-mono text-[11px] uppercase tracking-wider glass-muted">
                      {item.chip}
                    </span>
                  </div>
                  <h3 className="font-serif italic font-bold text-2xl sm:text-3xl text-primary-text mb-2.5">
                    {item.title}
                  </h3>
                  <p className="glass-muted text-sm sm:text-base leading-relaxed">
                    {item.description}
                  </p>
                </div>
              </motion.div>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}

