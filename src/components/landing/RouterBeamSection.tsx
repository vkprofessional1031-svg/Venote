'use client';

import { useEffect, useRef, useState } from 'react';
import { AnimatePresence, motion, useReducedMotion } from 'framer-motion';

type RouterNode = {
  id: 'organize' | 'wallet' | 'prep' | 'ask';
  title: string;
  color: string;
  pathD: string;
  description: string;
  sampleTrigger: string;
  sampleOutput: string;
  sampleMeta: string;
  iconPath: string;
};

const ROUTER_NODES: RouterNode[] = [
  {
    id: 'organize',
    title: 'Organize',
    color: '#FF5C38',
    pathD: 'M 400 16 C 400 72, 115 62, 115 124',
    description:
      'Formats messy thoughts into actionable checklists, rich notes, roadmaps, and tables.',
    sampleTrigger: '"buy milk and plan launch post"',
    sampleOutput: 'Checklist · 2 tasks created',
    sampleMeta: '□ buy milk   □ plan launch post',
    iconPath: 'M4 7h16M4 12h16M4 17h10',
  },
  {
    id: 'wallet',
    title: 'Wallet',
    color: '#5BBD8E',
    pathD: 'M 400 16 C 400 72, 305 68, 305 124',
    description:
      'Logs expenses and income, tracks category budgets and split bills, and summarizes spending.',
    sampleTrigger: '"spent 20 on lunch"',
    sampleOutput: '-$20.00 · Food & Dining',
    sampleMeta: 'Monthly budget updated automatically',
    iconPath: 'M20 8V5H5a2 2 0 0 0-2 2v12h17V8H5a1 1 0 0 1 0-2m11 6h4v4h-4z',
  },
  {
    id: 'prep',
    title: 'Prep',
    color: '#8B5CF6',
    pathD: 'M 400 16 C 400 72, 495 68, 495 124',
    description:
      'Tracks job applications across multiple rounds and surfaces upcoming deadlines in Due Soon.',
    sampleTrigger: '"Google OA due Friday"',
    sampleOutput: 'Google · Online Assessment',
    sampleMeta: 'Due Soon · Friday reminder active',
    iconPath: 'M8 6V4h8v2M3 11l9 4 9-4M3 6h18v14H3zM12 12v4',
  },
  {
    id: 'ask',
    title: 'Ask',
    color: '#E8B86D',
    pathD: 'M 400 16 C 400 72, 685 62, 685 124',
    description:
      'Answers plain-English questions across your saved notes, tasks, spending, and schedule.',
    sampleTrigger: '"How much did I spend this week?"',
    sampleOutput: '$64.50 across 3 transactions',
    sampleMeta: 'Based on 3 Wallet lookups',
    iconPath:
      'M8 10h.01M12 10h.01M16 10h.01M21 12c0 4.418-4.03 8-9 8a9.86 9.86 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z',
  },
];

export default function RouterBeamSection() {
  const reducedMotion = useReducedMotion();
  const sectionRef = useRef<HTMLElement>(null);
  const [inView, setInView] = useState(false);
  const [activeId, setActiveId] = useState<RouterNode['id']>('organize');

  useEffect(() => {
    const el = sectionRef.current;
    if (!el || typeof IntersectionObserver === 'undefined') {
      setInView(true);
      return;
    }
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) setInView(true);
      },
      { threshold: 0.2 }
    );
    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  return (
    <section
      ref={sectionRef}
      aria-labelledby="router-beam-heading"
      className="py-16 md:py-24 px-4 sm:px-6 md:px-12 relative"
    >
      <div className="max-w-6xl mx-auto">
        <div className="text-center mb-10 md:mb-12">
          <span className="font-mono text-xs uppercase tracking-widest px-3 py-1 rounded-full landing-subcard glass-muted inline-block mb-3">
            Intelligent Router
          </span>
          <h2
            id="router-beam-heading"
            className="font-serif italic font-bold text-3xl sm:text-4xl md:text-5xl tracking-tight text-primary-text"
          >
            One input. Four destinations.
          </h2>
          <p className="glass-muted max-w-xl mx-auto text-sm sm:text-base mt-3">
            Hover, focus, or tap any destination node to inspect how Venote routes your input.
          </p>
        </div>

        {/* Top Source Input Capsule */}
        <div className="max-w-xl mx-auto landing-glass-shell rounded-2xl px-4 py-3.5 sm:px-5 sm:py-4 flex items-center justify-between gap-3 relative z-10">
          <div className="flex items-center gap-3 min-w-0">
            <span
              aria-hidden="true"
              className="w-8 h-8 rounded-xl bg-primary-accent/15 border border-primary-accent/35 flex items-center justify-center text-primary-accent shrink-0"
            >
              <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path strokeLinecap="round" strokeLinejoin="round" d="M13 10V3L4 14h7v7l9-11h-7z" />
              </svg>
            </span>
            <span className="font-mono text-xs sm:text-sm text-primary-text truncate">
              {ROUTER_NODES.find((n) => n.id === activeId)?.sampleTrigger}
            </span>
          </div>
          <span className="font-mono text-[10px] uppercase tracking-wider px-2.5 py-1 rounded-full landing-subcard glass-muted shrink-0">
            Router Beam
          </span>
        </div>

        {/* Animated 4-Lane SVG Beam */}
        <div aria-hidden="true" className="w-full max-w-5xl mx-auto h-20 sm:h-28 -my-1 pointer-events-none">
          <svg
            className="w-full h-full overflow-visible"
            viewBox="0 0 800 132"
            fill="none"
            preserveAspectRatio="none"
          >
            {/* Stem from top input */}
            <line
              x1="400"
              y1="0"
              x2="400"
              y2="18"
              stroke="#FF5C38"
              strokeWidth="2.5"
              strokeOpacity="0.65"
            />
            <circle cx="400" cy="16" r="4" fill="#FF5C38" />

            {ROUTER_NODES.map((node) => {
              const isSelected = activeId === node.id;
              return (
                <g key={node.id}>
                  {/* Base faint path */}
                  <path
                    d={node.pathD}
                    stroke={node.color}
                    strokeOpacity={isSelected ? 0.55 : 0.22}
                    strokeWidth={isSelected ? 2.5 : 1.5}
                    strokeLinecap="round"
                  />

                  {/* Traveling pulse via strokeDashoffset when in view */}
                  {inView && !reducedMotion && (
                    <motion.path
                      d={node.pathD}
                      stroke={node.color}
                      strokeWidth={isSelected ? 3.2 : 2}
                      strokeLinecap="round"
                      strokeDasharray="36 260"
                      initial={{ strokeDashoffset: 296, opacity: 0.3 }}
                      animate={{
                        strokeDashoffset: [296, 0],
                        opacity: isSelected ? [0.5, 1, 0.5] : [0.25, 0.65, 0.25],
                      }}
                      transition={{
                        duration: isSelected ? 1.8 : 2.6,
                        repeat: Infinity,
                        ease: 'linear',
                      }}
                    />
                  )}
                </g>
              );
            })}
          </svg>
        </div>

        {/* Four Destination Glass Nodes */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 relative z-10">
          {ROUTER_NODES.map((node) => {
            const isSelected = activeId === node.id;
            return (
              <div
                key={node.id}
                role="button"
                tabIndex={0}
                aria-expanded={isSelected}
                onMouseEnter={() => setActiveId(node.id)}
                onFocus={() => setActiveId(node.id)}
                onClick={() => setActiveId(node.id)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' || e.key === ' ') {
                    e.preventDefault();
                    setActiveId(node.id);
                  }
                }}
                className={`landing-bento-card rounded-[24px] p-5 text-left cursor-pointer flex flex-col justify-between transition-colors focus-visible:outline-2 focus-visible:outline-primary-accent ${
                  isSelected ? 'ring-1 ring-primary-accent/40' : ''
                }`}
                style={{
                  borderColor: isSelected ? `${node.color}88` : undefined,
                }}
              >
                <div>
                  <div className="flex items-center justify-between gap-2 mb-3">
                    <div className="flex items-center gap-2.5">
                      <span
                        aria-hidden="true"
                        className="w-9 h-9 rounded-xl flex items-center justify-center shrink-0"
                        style={{
                          backgroundColor: `${node.color}20`,
                          color: node.color,
                          border: `1px solid ${node.color}55`,
                        }}
                      >
                        <svg
                          className="w-4 h-4"
                          viewBox="0 0 24 24"
                          fill="none"
                          stroke="currentColor"
                          strokeWidth="1.9"
                          strokeLinecap="round"
                          strokeLinejoin="round"
                        >
                          <path d={node.iconPath} />
                        </svg>
                      </span>
                      <h3 className="font-serif italic font-bold text-xl text-primary-text">
                        {node.title}
                      </h3>
                    </div>

                    <span
                      className="font-mono text-[10px] uppercase tracking-wider px-2 py-0.5 rounded-full border"
                      style={{
                        color: node.color,
                        borderColor: `${node.color}55`,
                        backgroundColor: `${node.color}14`,
                      }}
                    >
                      {isSelected ? 'Active' : 'Node'}
                    </span>
                  </div>

                  <p className="glass-muted text-xs sm:text-sm leading-relaxed">
                    {node.description}
                  </p>
                </div>

                {/* Expandable Tiny Example Card */}
                <AnimatePresence initial={false}>
                  {isSelected && (
                    <motion.div
                      key="sample-card"
                      initial={reducedMotion ? false : { opacity: 0, y: 6 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, y: 4 }}
                      transition={{ duration: reducedMotion ? 0 : 0.2, ease: 'easeOut' }}
                      className="mt-4 pt-3 border-t border-[var(--glass-hairline)]"
                    >
                      <div className="landing-subcard rounded-xl p-3 space-y-1">
                        <div className="flex items-center justify-between gap-2">
                          <span className="font-mono text-[10px] uppercase tracking-wider" style={{ color: node.color }}>
                            Routed Output
                          </span>
                          <span className="font-mono text-[10px] glass-muted">Sample</span>
                        </div>
                        <div className="font-sans text-xs font-bold text-primary-text">
                          {node.sampleOutput}
                        </div>
                        <div className="font-mono text-[11px] glass-muted truncate">
                          {node.sampleMeta}
                        </div>
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>
            );
          })}
        </div>
      </div>
    </section>
  );
}

