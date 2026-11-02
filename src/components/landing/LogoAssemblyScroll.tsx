'use client';

import { useEffect, useMemo, useRef, useState, type MouseEvent } from 'react';
import Image from 'next/image';
import {
  animate,
  motion,
  useMotionValue,
  useReducedMotion,
  useScroll,
  useSpring,
  useTransform,
  type MotionValue,
} from 'framer-motion';

// Deterministic seeded PRNG so server and client always match (zero hydration mismatch)
function createSeededRandom(seed: number) {
  let t = seed >>> 0;
  return () => {
    t += 0x6d2b79f5;
    let r = Math.imul(t ^ (t >>> 15), 1 | t);
    r ^= r + Math.imul(r ^ (r >>> 7), 61 | r);
    return ((r ^ (r >>> 14)) >>> 0) / 4294967296;
  };
}

type ThoughtFragmentSpec = {
  id: number;
  text: string;
  depth: 'near' | 'mid' | 'far';
  startX: number;
  startY: number;
  driftX: number;
  driftY: number;
  spiralX: number;
  spiralY: number;
  startRotate: number;
  baseScale: number;
  baseOpacity: number;
  gatherStart: number;
  gatherEnd: number;
  shardKind: 'triangle' | 'dot';
  shardColor: string;
};

type ShardPieceSpec = {
  id: number;
  kind: 'triangle' | 'dot';
  color: string;
  size: number;
  startX: number;
  startY: number;
  driftX: number;
  driftY: number;
  spiralX: number;
  spiralY: number;
  lockX: number;
  lockY: number;
  startRotate: number;
  lockRotate: number;
  gatherStart: number;
  gatherEnd: number;
};

const SAMPLE_THOUGHTS = [
  'spent 20 on lunch',
  'Google OA due Fri',
  'buy milk',
  'idea: voice notes',
  'gym Mon 7am',
  'call landlord',
  'update resume',
  '$1,200 freelance',
  'ship v2 roadmap',
  'split dinner $48',
  'mock interview Thu',
  'dentist Tue 3pm',
  'book flight home',
] as const;

const SORTED_CARDS = [
  {
    id: 'note',
    typeLabel: 'Note',
    headline: 'idea: voice notes',
    detail: 'Organized note · Tagged #product',
    accent: '#FF5C38',
    fanOffsetX: -120,
    iconPath: 'M4 7h16M4 12h16M4 17h10',
  },
  {
    id: 'expense',
    typeLabel: 'Expense',
    headline: '$20.00 · Food & Dining',
    detail: 'Auto-logged to Monthly Budget',
    accent: '#5BBD8E',
    fanOffsetX: 0,
    iconPath: 'M3 10h18M7 15h1m4 0h1m-7 4h12a3 3 0 003-3V8a3 3 0 00-3-3H6a3 3 0 00-3 3v8a3 3 0 003 3z',
  },
  {
    id: 'round',
    typeLabel: 'Round',
    headline: 'Google · Fri',
    detail: 'Online Assessment · Due Soon',
    accent: '#8B5CF6',
    fanOffsetX: 120,
    iconPath: 'M8 6V4h8v2M3 11l9 4 9-4M3 6h18v14H3z',
  },
] as const;

// V-shape & trail coordinates (centered around 0,0 inside the stage)
function computeVLockPoint(index: number, total: number, rand: () => number) {
  const u = index / Math.max(1, total - 1);
  if (u < 0.42) {
    // Left arm of V
    const t = u / 0.42;
    return {
      x: -36 + t * 34 + (rand() - 0.5) * 4,
      y: -30 + t * 62 + (rand() - 0.5) * 4,
    };
  }
  if (u < 0.84) {
    // Right arm of V
    const t = (u - 0.42) / 0.42;
    return {
      x: -2 + t * 38 + (rand() - 0.5) * 4,
      y: 32 - t * 62 + (rand() - 0.5) * 4,
    };
  }
  // Upper-right dispersion trail of the real Venote icon
  const t = (u - 0.84) / 0.16;
  return {
    x: 24 + t * 26 + (rand() - 0.5) * 6,
    y: -22 - t * 20 + (rand() - 0.5) * 6,
  };
}

function ThoughtFragmentNode({
  spec,
  progress,
  cursorRepelX,
  cursorRepelY,
}: {
  spec: ThoughtFragmentSpec;
  progress: MotionValue<number>;
  cursorRepelX: MotionValue<number>;
  cursorRepelY: MotionValue<number>;
}) {
  const xBase = useTransform(
    progress,
    [0, 0.25, (spec.gatherStart + spec.gatherEnd) * 0.5, spec.gatherEnd],
    [spec.startX, spec.startX + spec.driftX, spec.spiralX, 0]
  );
  const yBase = useTransform(
    progress,
    [0, 0.25, (spec.gatherStart + spec.gatherEnd) * 0.5, spec.gatherEnd],
    [spec.startY, spec.startY + spec.driftY, spec.spiralY, 0]
  );

  // Chaos-only cursor lean-away
  const chaosWeight = useTransform(progress, [0, 0.22, 0.32], [1, 0.8, 0]);
  const x = useTransform(() => xBase.get() + cursorRepelX.get() * chaosWeight.get() * (spec.depth === 'near' ? 1 : 0.55));
  const y = useTransform(() => yBase.get() + cursorRepelY.get() * chaosWeight.get() * (spec.depth === 'near' ? 1 : 0.55));

  const scale = useTransform(
    progress,
    [0, 0.25, spec.gatherEnd, 0.64],
    [spec.baseScale, spec.baseScale, 0.42, 0.18]
  );
  const rotate = useTransform(
    progress,
    [0, 0.25, spec.gatherEnd],
    [spec.startRotate, spec.startRotate * 0.6, 0]
  );

  // Text cross-fades into a shard during gather
  const crossMid = spec.gatherStart + (spec.gatherEnd - spec.gatherStart) * 0.55;
  const textOpacity = useTransform(
    progress,
    [0, 0.25, spec.gatherStart, crossMid],
    [spec.baseOpacity, spec.baseOpacity, spec.baseOpacity, 0]
  );
  const shardOpacity = useTransform(
    progress,
    [spec.gatherStart, crossMid, spec.gatherEnd, 0.66],
    [0, 0.95, 0.95, 0]
  );

  return (
    <motion.div
      style={{ x, y, scale, rotate }}
      className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 pointer-events-none select-none will-change-transform"
    >
      <motion.span
        style={{ opacity: textOpacity }}
        className={`inline-block whitespace-nowrap rounded-full px-3 py-1 font-mono text-[11px] sm:text-xs landing-subcard text-primary-text shadow-sm ${
          spec.depth === 'far' ? 'blur-[1px]' : ''
        }`}
      >
        {spec.text}
      </motion.span>

      <motion.span
        style={{ opacity: shardOpacity }}
        className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2"
      >
        {spec.shardKind === 'triangle' ? (
          <svg width="12" height="12" viewBox="0 0 12 12" fill="none">
            <polygon points="6,1 11,10 1,10" fill={spec.shardColor} />
          </svg>
        ) : (
          <span
            className="block w-2.5 h-2.5 rounded-full"
            style={{ backgroundColor: spec.shardColor }}
          />
        )}
      </motion.span>
    </motion.div>
  );
}

function ShardPieceNode({
  spec,
  progress,
}: {
  spec: ShardPieceSpec;
  progress: MotionValue<number>;
}) {
  const mid = (spec.gatherStart + spec.gatherEnd) * 0.5;
  const x = useTransform(
    progress,
    [0, 0.25, mid, spec.gatherEnd, 0.68, 0.76],
    [spec.startX, spec.startX + spec.driftX, spec.spiralX, spec.lockX, spec.lockX, 0]
  );
  const y = useTransform(
    progress,
    [0, 0.25, mid, spec.gatherEnd, 0.68, 0.76],
    [spec.startY, spec.startY + spec.driftY, spec.spiralY, spec.lockY, spec.lockY, 0]
  );
  const rotate = useTransform(
    progress,
    [0, 0.25, spec.gatherEnd, 0.68],
    [spec.startRotate, spec.startRotate + 28, spec.lockRotate, 0]
  );
  const scale = useTransform(
    progress,
    [0, 0.25, spec.gatherEnd, 0.66, 0.76],
    [1, 1.05, 0.95, 0.85, 0.2]
  );
  const opacity = useTransform(
    progress,
    [0, 0.25, spec.gatherEnd, 0.68, 0.76],
    [0.72, 0.88, 0.96, 0.9, 0]
  );

  return (
    <motion.div
      style={{ x, y, rotate, scale, opacity }}
      className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 pointer-events-none will-change-transform"
    >
      {spec.kind === 'triangle' ? (
        <svg width={spec.size} height={spec.size} viewBox="0 0 12 12" fill="none">
          <polygon points="6,1 11,10.5 1,10.5" fill={spec.color} />
        </svg>
      ) : (
        <span
          className="block rounded-full"
          style={{
            width: `${Math.max(4, spec.size * 0.55)}px`,
            height: `${Math.max(4, spec.size * 0.55)}px`,
            backgroundColor: spec.color,
          }}
        />
      )}
    </motion.div>
  );
}

function SortedCardItem({
  card,
  index,
  progress,
}: {
  card: (typeof SORTED_CARDS)[number];
  index: number;
  progress: MotionValue<number>;
}) {
  const start = 0.75 + index * 0.03;
  const end = Math.min(0.95, start + 0.14);

  const opacity = useTransform(progress, [start, end], [0, 1]);
  const y = useTransform(progress, [start, end], [-36, 0]);
  const x = useTransform(progress, [start, end], [card.fanOffsetX * 0.35, 0]);
  const scale = useTransform(progress, [start, end], [0.84, 1]);

  return (
    <motion.div
      style={{ opacity, y, x, scale }}
      className="landing-subcard rounded-2xl p-3.5 sm:p-4 text-left flex flex-col justify-between gap-2 border border-[var(--glass-border)] will-change-transform"
    >
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-2 min-w-0">
          <span
            aria-hidden="true"
            className="w-7 h-7 rounded-lg flex items-center justify-center shrink-0"
            style={{
              backgroundColor: `${card.accent}22`,
              color: card.accent,
              border: `1px solid ${card.accent}55`,
            }}
          >
            <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path strokeLinecap="round" strokeLinejoin="round" d={card.iconPath} />
            </svg>
          </span>
          <span className="font-mono text-xs font-semibold text-primary-text truncate">
            {card.typeLabel}
          </span>
        </div>
        <span className="font-mono text-[10px] px-1.5 py-0.5 rounded border border-[var(--glass-hairline)] glass-muted shrink-0">
          Sample
        </span>
      </div>
      <div>
        <div className="font-sans text-xs sm:text-sm font-bold text-primary-text truncate">
          {card.headline}
        </div>
        <div className="font-mono text-[11px] glass-muted truncate mt-0.5">
          {card.detail}
        </div>
      </div>
    </motion.div>
  );
}

export default function LogoAssemblyScroll() {
  const reducedMotion = useReducedMotion();
  const sectionRef = useRef<HTMLElement>(null);
  const [isMobileOrTouch, setIsMobileOrTouch] = useState(false);
  const [idleActive, setIdleActive] = useState(false);

  useEffect(() => {
    const mq = window.matchMedia('(max-width: 767px), (hover: none), (pointer: coarse)');
    const update = () => setIsMobileOrTouch(mq.matches);
    update();
    mq.addEventListener('change', update);
    return () => mq.removeEventListener('change', update);
  }, []);

  // Precompute all 13 text fragments & 40 small shards deterministically
  const { allFragments, allShards } = useMemo(() => {
    const rand = createSeededRandom(20261102);
    const shardColors = [
      'var(--primary-text)',
      '#FF5C38',
      'var(--primary-text)',
      '#FF5C38',
      '#8B5CF6',
      '#E8B86D',
      '#8A9A5B',
    ];

    const fragments: ThoughtFragmentSpec[] = SAMPLE_THOUGHTS.map((text, idx) => {
      const angle = (idx / SAMPLE_THOUGHTS.length) * Math.PI * 2 + (rand() - 0.5) * 0.35;
      const radiusX = 135 + rand() * 165;
      const radiusY = 72 + rand() * 78;
      const startX = Math.cos(angle) * radiusX;
      const startY = Math.sin(angle) * radiusY;

      // Spiral midpoint rotated by +50 degrees
      const spiralAngle = angle + 0.85;
      const spiralX = Math.cos(spiralAngle) * (radiusX * 0.42);
      const spiralY = Math.sin(spiralAngle) * (radiusY * 0.42);

      const depthRoll = idx % 3;
      const depth: 'near' | 'mid' | 'far' =
        depthRoll === 0 ? 'near' : depthRoll === 1 ? 'mid' : 'far';

      const gatherStart = 0.25 + (idx / SAMPLE_THOUGHTS.length) * 0.14;
      const gatherEnd = Math.min(0.6, gatherStart + 0.2);

      return {
        id: idx,
        text,
        depth,
        startX: Math.round(startX),
        startY: Math.round(startY),
        driftX: Math.round((rand() - 0.5) * 28),
        driftY: Math.round((rand() - 0.5) * 22),
        spiralX: Math.round(spiralX),
        spiralY: Math.round(spiralY),
        startRotate: Math.round((rand() - 0.5) * 22),
        baseScale: depth === 'near' ? 1.04 : depth === 'mid' ? 0.94 : 0.85,
        baseOpacity: depth === 'near' ? 0.92 : depth === 'mid' ? 0.76 : 0.56,
        gatherStart,
        gatherEnd,
        shardKind: idx % 3 === 0 ? 'dot' : 'triangle',
        shardColor: shardColors[idx % shardColors.length],
      };
    });

    const shards: ShardPieceSpec[] = Array.from({ length: 40 }, (_, idx) => {
      const angle = (idx / 40) * Math.PI * 2 + (rand() - 0.5) * 0.4;
      const radiusX = 95 + rand() * 210;
      const radiusY = 55 + rand() * 95;
      const startX = Math.cos(angle) * radiusX;
      const startY = Math.sin(angle) * radiusY;

      const spiralAngle = angle - 0.75;
      const spiralX = Math.cos(spiralAngle) * (radiusX * 0.46);
      const spiralY = Math.sin(spiralAngle) * (radiusY * 0.46);

      const lock = computeVLockPoint(idx, 40, rand);
      const gatherStart = 0.25 + (idx / 40) * 0.18;
      const gatherEnd = Math.min(0.6, gatherStart + 0.17);

      // Weighted toward cream (primary-text) and orange (#FF5C38), with sparse purple, gold, sage dots
      const isSparseDot = idx % 7 === 0 || idx % 9 === 0;
      const kind: 'triangle' | 'dot' = isSparseDot || idx % 4 === 0 ? 'dot' : 'triangle';
      const color = isSparseDot
        ? idx % 3 === 0
          ? '#8B5CF6'
          : idx % 3 === 1
          ? '#E8B86D'
          : '#8A9A5B'
        : idx % 2 === 0
        ? '#FF5C38'
        : 'var(--primary-text)';

      return {
        id: idx,
        kind,
        color,
        size: Math.round(8 + rand() * 5),
        startX: Math.round(startX),
        startY: Math.round(startY),
        driftX: Math.round((rand() - 0.5) * 24),
        driftY: Math.round((rand() - 0.5) * 20),
        spiralX: Math.round(spiralX),
        spiralY: Math.round(spiralY),
        lockX: Math.round(lock.x * 10) / 10,
        lockY: Math.round(lock.y * 10) / 10,
        startRotate: Math.round((rand() - 0.5) * 140),
        lockRotate: Math.round((rand() - 0.5) * 25),
        gatherStart,
        gatherEnd,
      };
    });

    return { allFragments: fragments, allShards: shards };
  }, []);

  const visibleFragments = isMobileOrTouch ? allFragments.slice(0, 6) : allFragments;
  const visibleShards = isMobileOrTouch ? allShards.slice(0, 16) : allShards;

  // Scroll progress for desktop pinned scene
  const { scrollYProgress } = useScroll({
    target: sectionRef,
    offset: ['start start', 'end end'],
  });

  // Play-once progress for mobile/touch (3s total when entering view) or static 1 for reduced-motion
  const fallbackProgress = useMotionValue(reducedMotion ? 1 : 0);

  useEffect(() => {
    if (reducedMotion) {
      fallbackProgress.set(1);
      return;
    }
    if (!isMobileOrTouch) return;

    const el = sectionRef.current;
    if (!el || typeof IntersectionObserver === 'undefined') {
      fallbackProgress.set(1);
      return;
    }

    let hasPlayed = false;
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting && !hasPlayed) {
          hasPlayed = true;
          animate(fallbackProgress, 1, {
            duration: 3,
            ease: [0.22, 1, 0.36, 1],
          });
          observer.disconnect();
        }
      },
      { threshold: 0.25 }
    );
    observer.observe(el);
    return () => observer.disconnect();
  }, [isMobileOrTouch, reducedMotion, fallbackProgress]);

  const activeProgress = reducedMotion || isMobileOrTouch ? fallbackProgress : scrollYProgress;

  // Track completion for desktop idle stream
  useEffect(() => {
    if (reducedMotion || isMobileOrTouch) {
      setIdleActive(false);
      return;
    }
    const unsubscribe = activeProgress.on('change', (v) => {
      setIdleActive(v >= 0.92);
    });
    return () => unsubscribe();
  }, [activeProgress, reducedMotion, isMobileOrTouch]);

  // Desktop cursor interaction (fragments lean away in chaos; logo tile tilts up to 6 deg)
  const rawRepelX = useMotionValue(0);
  const rawRepelY = useMotionValue(0);
  const rawTiltX = useMotionValue(0);
  const rawTiltY = useMotionValue(0);

  const cursorRepelX = useSpring(rawRepelX, { stiffness: 140, damping: 20 });
  const cursorRepelY = useSpring(rawRepelY, { stiffness: 140, damping: 20 });
  const tiltRotateX = useSpring(rawTiltX, { stiffness: 160, damping: 22 });
  const tiltRotateY = useSpring(rawTiltY, { stiffness: 160, damping: 22 });

  const handlePanelMouseMove = (e: MouseEvent<HTMLDivElement>) => {
    if (reducedMotion || isMobileOrTouch) return;
    const rect = e.currentTarget.getBoundingClientRect();
    const nx = ((e.clientX - rect.left) / rect.width - 0.5) * 2; // -1 to 1
    const ny = ((e.clientY - rect.top) / rect.height - 0.5) * 2; // -1 to 1

    rawRepelX.set(-nx * 14);
    rawRepelY.set(-ny * 10);
    rawTiltX.set(-ny * 6);
    rawTiltY.set(nx * 6);
  };

  const handlePanelMouseLeave = () => {
    rawRepelX.set(0);
    rawRepelY.set(0);
    rawTiltX.set(0);
    rawTiltY.set(0);
  };

  // Phase transforms for central logo tile, shockwave, panel flash, and headline
  const tileGlowOpacity = useTransform(
    activeProgress,
    [0, 0.25, 0.6, 0.72, 1],
    [0.12, 0.2, 0.68, 0.85, 0.6]
  );
  const tileScale = useTransform(
    activeProgress,
    [0, 0.25, 0.6, 0.66, 0.74, 1],
    [0.86, 0.9, 1, 1.06, 1, 1]
  );
  const logoImageOpacity = useTransform(
    activeProgress,
    [0, 0.35, 0.64, 0.74],
    [0.35, 0.55, 0.92, 1]
  );

  // Snap shockwave ring (60% -> 75%)
  const shockwaveScale = useTransform(activeProgress, [0.6, 0.75], [0.55, 2.35]);
  const shockwaveOpacity = useTransform(activeProgress, [0.59, 0.63, 0.75], [0, 0.75, 0]);

  // Subtle panel flash on snap (60% -> 74%)
  const panelFlashOpacity = useTransform(activeProgress, [0.6, 0.65, 0.74], [0, 0.16, 0]);

  // Headline & accent words ("One place." fades in last and letter-spacing settles)
  const firstPhraseOpacity = useTransform(activeProgress, [0, 0.68, 0.82], [0.7, 0.88, 1]);
  const accentPhraseOpacity = useTransform(activeProgress, [0, 0.74, 0.94], [0.2, 0.35, 1]);
  const accentPhraseScale = useTransform(activeProgress, [0.74, 0.95], [1.04, 1]);

  const isPinnedDesktop = !reducedMotion && !isMobileOrTouch;

  return (
    <section
      ref={sectionRef}
      aria-labelledby="logo-assembly-heading"
      className={`relative px-4 sm:px-6 md:px-12 ${
        isPinnedDesktop ? 'md:h-[240vh] py-12' : 'py-16 md:py-24'
      }`}
    >
      <div
        className={`max-w-5xl mx-auto flex flex-col items-center justify-center text-center ${
          isPinnedDesktop ? 'md:sticky md:top-20 md:min-h-[calc(100vh-5rem)]' : ''
        }`}
      >
        <div
          onMouseMove={handlePanelMouseMove}
          onMouseLeave={handlePanelMouseLeave}
          className="landing-glass-shell rounded-[32px] p-6 sm:p-10 md:p-12 w-full relative overflow-hidden flex flex-col items-center"
        >
          {/* Subtle Snap Flash Overlay */}
          <motion.div
            aria-hidden="true"
            style={{ opacity: panelFlashOpacity }}
            className="absolute inset-0 bg-gradient-to-br from-primary-accent/30 via-white/20 to-[#8B5CF6]/25 pointer-events-none z-0"
          />

          {/* Stage: Floating Thoughts, Shards, and Central Venote Logo Tile */}
          <div
            aria-hidden="true"
            style={{ perspective: '900px' }}
            className="relative w-full h-[220px] sm:h-[250px] flex items-center justify-center z-10"
          >
            {/* Growing Brand Glow behind the Logo Tile */}
            <motion.div
              style={{ opacity: tileGlowOpacity }}
              className="absolute w-44 h-44 sm:w-52 sm:h-52 rounded-full blur-3xl pointer-events-none"
            >
              <div
                className="w-full h-full rounded-full"
                style={{
                  background:
                    'radial-gradient(circle, rgba(255,92,56,0.6) 0%, rgba(139,92,246,0.38) 52%, rgba(232,184,109,0.22) 72%, transparent 85%)',
                }}
              />
            </motion.div>

            {/* Expanding Shockwave Ring during SNAP (60-75%) */}
            <motion.div
              style={{ scale: shockwaveScale, opacity: shockwaveOpacity }}
              className="absolute w-28 h-28 rounded-full border-2 border-primary-accent/70 pointer-events-none will-change-transform"
            />

            {/* Layer 1: Thought Fragments (cross-fading into shards during GATHER) */}
            {!reducedMotion &&
              visibleFragments.map((frag) => (
                <ThoughtFragmentNode
                  key={frag.id}
                  spec={frag}
                  progress={activeProgress}
                  cursorRepelX={cursorRepelX}
                  cursorRepelY={cursorRepelY}
                />
              ))}

            {/* Layer 2: Small Shards (triangles & dots locking into the V) */}
            {!reducedMotion &&
              visibleShards.map((shard) => (
                <ShardPieceNode key={shard.id} spec={shard} progress={activeProgress} />
              ))}

            {/* Desktop Idle Stream Shards after completion */}
            {idleActive && !reducedMotion && (
              <div className="absolute inset-0 pointer-events-none">
                {[
                  { x: -110, y: -55, color: '#FF5C38', delay: 0 },
                  { x: 118, y: -42, color: '#E8B86D', delay: 0.7 },
                  { x: -95, y: 58, color: '#8B5CF6', delay: 1.4 },
                  { x: 105, y: 48, color: '#FF5C38', delay: 2.1 },
                ].map((s, idx) => (
                  <motion.span
                    key={idx}
                    initial={{ x: s.x, y: s.y, opacity: 0, scale: 0.9 }}
                    animate={{
                      x: [s.x, s.x * 0.4, 0],
                      y: [s.y, s.y * 0.3, 0],
                      opacity: [0, 0.85, 0],
                      scale: [0.9, 0.75, 0.25],
                    }}
                    transition={{
                      duration: 2.4,
                      delay: s.delay,
                      repeat: Infinity,
                      ease: 'easeInOut',
                    }}
                    className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 block w-2 h-2 rounded-full"
                    style={{ backgroundColor: s.color }}
                  />
                ))}
              </div>
            )}

            {/* Layer 3: Central Venote Logo Tile */}
            <motion.div
              style={{
                scale: tileScale,
                rotateX: isPinnedDesktop ? tiltRotateX : 0,
                rotateY: isPinnedDesktop ? tiltRotateY : 0,
              }}
              className="relative z-20 w-24 h-24 sm:w-28 sm:h-28 rounded-3xl landing-subcard flex items-center justify-center p-4 shadow-2xl border border-primary-accent/45 will-change-transform"
            >
              <motion.div style={{ opacity: logoImageOpacity }} className="w-full h-full">
                <Image
                  src="/brand/venote-icon.png"
                  alt="Venote V mark"
                  width={1146}
                  height={1155}
                  unoptimized
                  className="w-full h-full object-contain"
                />
              </motion.div>
            </motion.div>
          </div>

          {/* Step 4 (75-100%): Three Sorted Glass Cards Fanning Out Below the Logo */}
          <div
            aria-label="Sample sorted outputs"
            className="relative z-10 w-full max-w-3xl grid grid-cols-1 sm:grid-cols-3 gap-3 mt-2 mb-6"
          >
            {SORTED_CARDS.map((card, idx) => (
              <SortedCardItem
                key={card.id}
                card={card}
                index={idx}
                progress={activeProgress}
              />
            ))}
          </div>

          {/* Copy: UNIFIED WORKSPACE Chip, Headline, and Subtitle */}
          <div className="relative z-10 max-w-xl">
            <span className="font-mono text-[11px] uppercase tracking-widest px-3 py-1 rounded-full landing-subcard glass-muted inline-block mb-3">
              Unified Workspace
            </span>
            <h2
              id="logo-assembly-heading"
              className="font-serif italic font-bold text-3xl sm:text-4xl md:text-5xl tracking-tight text-primary-text"
            >
              <motion.span style={{ opacity: firstPhraseOpacity }}>
                Scattered thoughts.{' '}
              </motion.span>
              <motion.span
                style={{ opacity: accentPhraseOpacity, scale: accentPhraseScale }}
                className="text-primary-accent inline-block"
              >
                One place.
              </motion.span>
            </h2>
            <p className="glass-muted text-sm sm:text-base mt-3 leading-relaxed">
              Every fragment—whether a quick expense, an interview deadline, or a late-night idea—snaps into structure automatically.
            </p>
          </div>
        </div>
      </div>
    </section>
  );
}
