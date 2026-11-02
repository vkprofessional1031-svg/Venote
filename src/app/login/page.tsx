'use client';

import BrandLogo from '@/components/BrandLogo';
import AuroraBackground from '@/components/landing/AuroraBackground';
import { useTheme } from '@/components/ThemeProvider';
import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type MouseEvent,
  type PointerEvent,
} from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import Image from 'next/image';
import {
  AnimatePresence,
  motion,
  useMotionValue,
  useReducedMotion,
  useSpring,
} from 'framer-motion';
import { supabase } from '@/lib/supabase';

// Deterministic seeded PRNG (no Math.random during render, zero hydration mismatch)
function createSeededRandom(seed: number) {
  let t = seed >>> 0;
  return () => {
    t += 0x6d2b79f5;
    let r = Math.imul(t ^ (t >>> 15), 1 | t);
    r ^= r + Math.imul(r ^ (r >>> 7), 61 | r);
    return ((r ^ (r >>> 14)) >>> 0) / 4294967296;
  };
}

type OrbitShardSpec = {
  id: number;
  group: 1 | 2 | 3;
  kind: 'triangle' | 'dot';
  color: string;
  depth: 'near' | 'mid' | 'far';
  size: number;
  orbitRadius: number;
  ellipseRatio: number;
  planeTiltDeg: number;
  startAngleDeg: number;
  durationSec: number;
  direction: 1 | -1;
  lockX: number;
  lockY: number;
  errorX: number;
  errorY: number;
};

type KeystrokeSpark = {
  id: number;
  startY: number;
  arcY: number;
  color: string;
};

function OrbitingShardNode({
  shard,
  isLocked,
  hasError,
  reducedMotion,
  radiusScale,
}: {
  shard: OrbitShardSpec;
  isLocked: boolean;
  hasError: boolean;
  reducedMotion: boolean;
  radiusScale: number;
}) {
  const r = Math.round(shard.orbitRadius * radiusScale);
  const headOpacity =
    shard.depth === 'near' ? 0.96 : shard.depth === 'mid' ? 0.8 : 0.62;

  // When locked into the V or scattered on error, smoothly spring to target x/y
  if (reducedMotion || isLocked || hasError) {
    const targetX = hasError ? shard.errorX * radiusScale : shard.lockX;
    const targetY = hasError ? shard.errorY * radiusScale : shard.lockY;

    return (
      <motion.div
        initial={false}
        animate={{
          x: targetX,
          y: targetY,
          scale: isLocked ? 0.78 : 1.05,
          opacity: isLocked ? 0.55 : 0.9,
          rotate: 0,
        }}
        transition={{
          type: 'spring',
          stiffness: 190,
          damping: 20,
          duration: reducedMotion ? 0 : undefined,
        }}
        className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 pointer-events-none will-change-transform"
      >
        {shard.kind === 'triangle' ? (
          <svg width={shard.size} height={shard.size} viewBox="0 0 12 12" fill="none">
            <polygon points="6,1 11,10.5 1,10.5" fill={shard.color} />
          </svg>
        ) : (
          <span
            className="block rounded-full"
            style={{
              width: `${shard.size}px`,
              height: `${shard.size}px`,
              backgroundColor: shard.color,
            }}
          />
        )}
      </motion.div>
    );
  }

  // Active elliptical orbit with 2 fading ghost trail copies (transforms only)
  const endAngle = shard.startAngleDeg + shard.direction * 360;
  const trailStep = -shard.direction * 14;

  return (
    <div
      className="absolute left-1/2 top-1/2 pointer-events-none"
      style={{
        transform: `rotate(${shard.planeTiltDeg}deg) scaleY(${shard.ellipseRatio})`,
      }}
    >
      <motion.div
        initial={{ rotate: shard.startAngleDeg }}
        animate={{ rotate: [shard.startAngleDeg, endAngle] }}
        transition={{
          duration: shard.durationSec,
          repeat: Infinity,
          ease: 'linear',
        }}
        className="relative w-0 h-0 will-change-transform"
      >
        {/* Leading Shard + 2 Fading Ghost Trail Copies */}
        {[0, 1, 2].map((ghostIdx) => {
          const angleOffset = ghostIdx * trailStep;
          const ghostOpacity =
            ghostIdx === 0
              ? headOpacity
              : ghostIdx === 1
              ? headOpacity * 0.42
              : headOpacity * 0.18;
          const ghostScale = ghostIdx === 0 ? 1 : ghostIdx === 1 ? 0.78 : 0.58;

          return (
            <div
              key={ghostIdx}
              className="absolute left-0 top-0"
              style={{
                transform: `rotate(${angleOffset}deg) translateX(${r}px) scale(${ghostScale})`,
                opacity: ghostOpacity,
              }}
            >
              {shard.kind === 'triangle' ? (
                <svg
                  width={shard.size}
                  height={shard.size}
                  viewBox="0 0 12 12"
                  fill="none"
                  className="-translate-x-1/2 -translate-y-1/2"
                >
                  <polygon points="6,1 11,10.5 1,10.5" fill={shard.color} />
                </svg>
              ) : (
                <span
                  className="block rounded-full -translate-x-1/2 -translate-y-1/2"
                  style={{
                    width: `${shard.size}px`,
                    height: `${shard.size}px`,
                    backgroundColor: shard.color,
                  }}
                />
              )}
            </div>
          );
        })}
      </motion.div>
    </div>
  );
}

function LetterRevealStatus({
  text,
  hasError,
  reducedMotion,
}: {
  text: string;
  hasError: boolean;
  reducedMotion: boolean;
}) {
  const chars = Array.from(text);
  return (
    <div className="relative min-h-[20px] flex items-center justify-center">
      {/* Screen reader polite announcement */}
      <span className="sr-only" aria-live="polite" aria-atomic="true">
        {text}
      </span>

      <AnimatePresence mode="wait" initial={false}>
        <motion.p
          key={text}
          aria-hidden="true"
          initial={reducedMotion ? false : { opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: reducedMotion ? 0 : 0.1 }}
          className={`font-mono text-[11px] uppercase tracking-wider ${
            hasError ? 'text-red-500 dark:text-red-300' : 'glass-muted'
          }`}
        >
          {reducedMotion
            ? text
            : chars.map((ch, i) => (
                <motion.span
                  key={`${i}-${ch}`}
                  initial={{ opacity: 0, y: 3 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{
                    duration: 0.14,
                    delay: Math.min(0.16, i * 0.006),
                    ease: 'easeOut',
                  }}
                  className="inline-block"
                >
                  {ch === ' ' ? '\u00A0' : ch}
                </motion.span>
              ))}
        </motion.p>
      </AnimatePresence>
    </div>
  );
}

export default function Login() {
  const [isSignUp, setIsSignUp] = useState(false);
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [rememberMe, setRememberMe] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [errorShakeKey, setErrorShakeKey] = useState(0);
  const [loading, setLoading] = useState(false);
  const [authSuccess, setAuthSuccess] = useState(false);
  const [focusedField, setFocusedField] = useState<'name' | 'email' | 'password' | null>(null);

  // Mobile/touch detection
  const [isMobileOrTouch, setIsMobileOrTouch] = useState(false);
  useEffect(() => {
    const mq = window.matchMedia('(max-width: 1023px), (hover: none), (pointer: coarse)');
    const update = () => setIsMobileOrTouch(mq.matches);
    update();
    mq.addEventListener('change', update);
    return () => mq.removeEventListener('change', update);
  }, []);

  // Keystroke sparks & logo pulse state
  const [sparks, setSparks] = useState<KeystrokeSpark[]>([]);
  const [sparkPulseKey, setSparkPulseKey] = useState(0);
  const lastSparkTimeRef = useRef(0);
  const sparkSeqRef = useRef(0);

  // Button pointer ripple state
  const [btnRipple, setBtnRipple] = useState<{ id: number; x: number; y: number } | null>(null);

  const router = useRouter();
  const reducedMotion = Boolean(useReducedMotion());
  const { resolvedTheme, setTheme } = useTheme();

  // Strictly boolean/format signals (never reads, logs, stores, or transmits password content)
  const emailValid = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim());
  const hasPassword = password.length > 0;

  // Precompute 15 orbiting shards deterministically with seeded PRNG
  const allShards = useMemo<OrbitShardSpec[]>(() => {
    const rand = createSeededRandom(20261103);
    const colors = [
      '#FF5C38',
      'var(--primary-text)',
      '#8B5CF6',
      '#E8B86D',
      '#FF5C38',
      '#5BBD8E',
    ];

    // V-shape lock coordinates around (0,0)
    const lockCoords = [
      [-28, -22], [-22, -8], [-15, 6], [-8, 20], [0, 30],
      [8, 20], [15, 6], [22, -8], [28, -22], [34, -30],
      [-34, -30], [20, -24], [28, -14], [-18, -20], [0, 14],
    ];

    return Array.from({ length: 15 }, (_, idx) => {
      const group = ((idx % 3) + 1) as 1 | 2 | 3;
      const depth: 'near' | 'mid' | 'far' =
        idx % 3 === 0 ? 'near' : idx % 3 === 1 ? 'mid' : 'far';
      const size = depth === 'near' ? 11 : depth === 'mid' ? 9 : 7;
      const orbitRadius = 64 + (idx % 5) * 14 + Math.round(rand() * 10);
      const ellipseRatio = Math.round((0.52 + rand() * 0.28) * 100) / 100;
      const planeTiltDeg = Math.round(-36 + (idx * 27) % 72 + (rand() - 0.5) * 16);
      const startAngleDeg = Math.round((idx / 15) * 360 + rand() * 25);
      const durationSec = Math.round((7.5 + rand() * 5.5) * 10) / 10;
      const direction: 1 | -1 = idx % 2 === 0 ? 1 : -1;
      const [lx, ly] = lockCoords[idx];
      const errAngle = (idx / 15) * Math.PI * 2;

      return {
        id: idx,
        group,
        kind: idx % 3 === 0 ? 'dot' : 'triangle',
        color: colors[idx % colors.length],
        depth,
        size,
        orbitRadius,
        ellipseRatio,
        planeTiltDeg,
        startAngleDeg,
        durationSec,
        direction,
        lockX: lx,
        lockY: ly,
        errorX: Math.round(Math.cos(errAngle) * (95 + rand() * 25)),
        errorY: Math.round(Math.sin(errAngle) * (75 + rand() * 22)),
      };
    });
  }, []);

  const visibleShards = isMobileOrTouch ? allShards.slice(0, 8) : allShards;

  // Throttled generic keystroke spark launcher (120ms throttle, max 6 desktop / 3 mobile)
  const triggerKeystrokeSpark = useCallback(
    (source: 'email' | 'password' | 'name') => {
      if (reducedMotion) return;
      const now = performance.now();
      if (now - lastSparkTimeRef.current < 120) return;
      lastSparkTimeRef.current = now;

      const maxInFlight = isMobileOrTouch ? 3 : 6;
      const id = ++sparkSeqRef.current;
      const colors = ['#FF5C38', '#E8B86D', '#8B5CF6'];
      const color =
        source === 'email'
          ? colors[0]
          : source === 'password'
          ? colors[2]
          : colors[1];
      const startY = source === 'email' ? -14 : source === 'password' ? 22 : -36;
      const arcY = startY - 24 + ((id % 3) - 1) * 12;

      setSparks((current) => [...current.slice(-(maxInFlight - 1)), { id, startY, arcY, color }]);
    },
    [reducedMotion, isMobileOrTouch]
  );

  // Live status line text
  const statusLine = useMemo(() => {
    if (error) return "Something's off. Try again.";
    if (authSuccess) return 'Welcome in';
    if (loading) return 'Signing you in';
    if (emailValid && hasPassword) return 'Almost sorted';
    if (emailValid) return 'Got your email';
    return 'Awaiting your thoughts';
  }, [error, authSuccess, loading, emailValid, hasPassword]);

  // Assembled stage count (0..3)
  const assembledStage = useMemo(() => {
    if (reducedMotion || loading || authSuccess) return 3;
    let count = 0;
    if (emailValid) count += 1;
    if (hasPassword) count += 1;
    return count;
  }, [reducedMotion, loading, authSuccess, emailValid, hasPassword]);

  // Desktop 3D stage tilt (max ~3 degrees) + border specular spotlight
  const rawTiltX = useMotionValue(0);
  const rawTiltY = useMotionValue(0);
  const stageRotateX = useSpring(rawTiltX, { stiffness: 150, damping: 22 });
  const stageRotateY = useSpring(rawTiltY, { stiffness: 150, damping: 22 });

  const handleStageMouseMove = (e: MouseEvent<HTMLDivElement>) => {
    const el = e.currentTarget;
    const rect = el.getBoundingClientRect();
    const localX = e.clientX - rect.left;
    const localY = e.clientY - rect.top;
    el.style.setProperty('--stage-spot-x', `${localX}px`);
    el.style.setProperty('--stage-spot-y', `${localY}px`);

    if (reducedMotion || isMobileOrTouch) return;
    const nx = (localX / rect.width - 0.5) * 2;
    const ny = (localY / rect.height - 0.5) * 2;
    rawTiltX.set(-ny * 2.8);
    rawTiltY.set(nx * 2.8);
  };

  const handleStageMouseLeave = () => {
    rawTiltX.set(0);
    rawTiltY.set(0);
  };

  const handleGoogleMouseMove = (e: MouseEvent<HTMLButtonElement>) => {
    const rect = e.currentTarget.getBoundingClientRect();
    e.currentTarget.style.setProperty('--g-spot-x', `${e.clientX - rect.left}px`);
    e.currentTarget.style.setProperty('--g-spot-y', `${e.clientY - rect.top}px`);
  };

  const handlePrimaryPointerDown = (e: PointerEvent<HTMLButtonElement>) => {
    if (reducedMotion || loading) return;
    const rect = e.currentTarget.getBoundingClientRect();
    setBtnRipple({
      id: Date.now(),
      x: e.clientX - rect.left,
      y: e.clientY - rect.top,
    });
  };

  const handleAuth = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);

    try {
      if (!rememberMe) {
        window.sessionStorage.setItem('useSessionStorageAuth', 'true');
      } else {
        window.sessionStorage.removeItem('useSessionStorageAuth');
      }

      if (isSignUp) {
        const { data, error } = await supabase.auth.signUp({
          email,
          password,
          options: {
            data: {
              name,
            },
          },
        });
        if (error) throw error;
        // On success, trigger visual completion immediately and redirect without artificial delay
        setAuthSuccess(true);
        const { data: settings } = await supabase
          .from('user_settings')
          .select('default_view')
          .eq('user_id', data.user?.id)
          .single();
        router.push(settings?.default_view || '/app');
      } else {
        const { data, error } = await supabase.auth.signInWithPassword({
          email,
          password,
        });
        if (error) throw error;
        // On success, trigger visual completion immediately and redirect without artificial delay
        setAuthSuccess(true);
        const { data: settings } = await supabase
          .from('user_settings')
          .select('default_view')
          .eq('user_id', data.user?.id)
          .single();
        router.push(settings?.default_view || '/app');
      }
    } catch (err: any) {
      setAuthSuccess(false);
      setError(err.message || 'An error occurred during authentication.');
      setErrorShakeKey((k) => k + 1);
    } finally {
      setLoading(false);
    }
  };

  const handleGoogleLogin = async () => {
    setLoading(true);
    setError(null);
    try {
      const { error } = await supabase.auth.signInWithOAuth({
        provider: 'google',
        options: {
          redirectTo: `${window.location.origin}/auth/callback`,
        },
      });
      if (error) throw error;
    } catch (err: any) {
      setError(err.message || 'An error occurred with Google Login.');
      setErrorShakeKey((k) => k + 1);
      setLoading(false);
    }
  };

  return (
    <div
      style={{
        paddingTop: 'max(16px, env(safe-area-inset-top))',
        paddingBottom: 'max(24px, env(safe-area-inset-bottom))',
        paddingLeft: 'max(16px, env(safe-area-inset-left))',
        paddingRight: 'max(16px, env(safe-area-inset-right))',
      }}
      className="min-h-dvh bg-background text-primary-text flex flex-col justify-between font-sans relative overflow-x-clip overflow-y-auto"
    >
      <AuroraBackground />

      {/* Top Bar: Glass "Back" Chip (Top-Left) + Glass Theme Toggle (Top-Right) */}
      <header className="w-full max-w-6xl mx-auto flex items-center justify-between gap-3 relative z-20">
        <Link
          href="/"
          className="min-h-[44px] px-4 py-2 rounded-full landing-nav-pill inline-flex items-center gap-2 text-sm font-medium text-primary-text/90 hover:text-primary-text transition-all active:scale-95 focus-visible:outline-2 focus-visible:outline-primary-accent"
        >
          <svg
            aria-hidden="true"
            className="w-4 h-4"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <path d="M19 12H5M12 19l-7-7 7-7" />
          </svg>
          <span>Back</span>
        </Link>

        <button
          type="button"
          onClick={() => setTheme(resolvedTheme === 'dark' ? 'light' : 'dark')}
          aria-label={resolvedTheme === 'dark' ? 'Switch to light theme' : 'Switch to dark theme'}
          title={resolvedTheme === 'dark' ? 'Switch to light theme' : 'Switch to dark theme'}
          className="min-h-[44px] min-w-[44px] px-3 rounded-full landing-nav-pill inline-flex items-center justify-center text-primary-text/85 hover:text-primary-text transition-all active:scale-95 focus-visible:outline-2 focus-visible:outline-primary-accent cursor-pointer"
        >
          {resolvedTheme === 'dark' ? (
            <svg aria-hidden="true" className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <circle cx="12" cy="12" r="4" />
              <path strokeLinecap="round" d="M12 2v2m0 16v2M4.93 4.93l1.41 1.41m11.32 11.32l1.41 1.41M2 12h2m16 0h2M4.93 19.07l1.41-1.41m11.32-11.32l1.41-1.41" />
            </svg>
          ) : (
            <svg aria-hidden="true" className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path strokeLinecap="round" strokeLinejoin="round" d="M21 12.79A9 9 0 1111.21 3 7 7 0 0021 12.79z" />
            </svg>
          )}
        </button>
      </header>

      {/* Main Content: ONE Unified Glass Stage (Scene Left + Form Right on lg, Stacked on Mobile) */}
      <main
        style={{ perspective: '1200px' }}
        className="flex-1 flex items-center justify-center py-5 sm:py-8 relative z-10"
      >
        <motion.div
          initial={reducedMotion ? false : { opacity: 0, y: 14, scale: 0.985 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          transition={{ duration: reducedMotion ? 0 : 0.34, ease: [0.22, 1, 0.36, 1] }}
          style={{
            rotateX: !isMobileOrTouch && !reducedMotion ? stageRotateX : 0,
            rotateY: !isMobileOrTouch && !reducedMotion ? stageRotateY : 0,
          }}
          className="w-full max-w-[440px] lg:max-w-[920px] relative will-change-transform"
        >
          {/* Ambient Warm Glow Behind the Unified Stage */}
          <div
            aria-hidden="true"
            className="absolute -inset-4 -z-10 rounded-[40px] blur-3xl opacity-45 pointer-events-none"
            style={{
              background:
                'radial-gradient(circle at 30% 45%, rgba(255,92,56,0.38), rgba(139,92,246,0.24) 55%, rgba(232,184,109,0.16) 78%, transparent 90%)',
            }}
          />

          <motion.div
            key={errorShakeKey}
            onMouseMove={handleStageMouseMove}
            onMouseLeave={handleStageMouseLeave}
            animate={
              error && errorShakeKey > 0 && !reducedMotion
                ? { x: [0, -8, 8, -5, 5, 0] }
                : { x: 0 }
            }
            transition={{ duration: 0.34, ease: 'easeInOut' }}
            className="login-stage-shell rounded-[30px] overflow-hidden flex flex-col lg:flex-row items-stretch"
          >
            {/* LEFT HALF (or Compact Top on Mobile): Living Orbiting V Scene */}
            <div className="lg:w-[45%] p-5 sm:p-7 lg:p-10 flex flex-col items-center justify-center text-center relative select-none">
              {/* Orbiting Shards + Keystroke Sparks + Central Venote V Mark */}
              <div
                aria-hidden="true"
                className="relative w-full h-36 sm:h-44 lg:h-60 flex items-center justify-center"
              >
                {/* Brand Glow behind V mark */}
                <motion.div
                  initial={false}
                  animate={{
                    opacity: error ? 0.25 : 0.26 + assembledStage * 0.2,
                    scale: (loading || authSuccess) && !reducedMotion ? [1, 1.14, 1] : 1,
                  }}
                  transition={{ duration: reducedMotion ? 0 : 0.4, ease: 'easeOut' }}
                  className="absolute w-36 h-36 lg:w-48 lg:h-48 rounded-full blur-2xl pointer-events-none"
                  style={{
                    background: error
                      ? 'radial-gradient(circle, rgba(239,68,68,0.48) 0%, transparent 72%)'
                      : 'radial-gradient(circle, rgba(255,92,56,0.6) 0%, rgba(139,92,246,0.38) 55%, transparent 78%)',
                  }}
                />

                {/* Success Shockwave Ring */}
                <AnimatePresence>
                  {authSuccess && !reducedMotion && (
                    <motion.div
                      key="success-ring"
                      initial={{ scale: 0.65, opacity: 0.9 }}
                      animate={{ scale: 2.35, opacity: 0 }}
                      exit={{ opacity: 0 }}
                      transition={{ duration: 0.55, ease: 'easeOut' }}
                      className="absolute w-24 h-24 rounded-full border-2 border-primary-accent pointer-events-none"
                    />
                  )}
                </AnimatePresence>

                {/* Elliptical Orbiting Shards with Ghost Light Trails */}
                {visibleShards.map((shard) => {
                  const isLocked =
                    !error &&
                    (reducedMotion ||
                      loading ||
                      authSuccess ||
                      (shard.group === 1 && emailValid) ||
                      (shard.group === 2 && hasPassword));

                  return (
                    <OrbitingShardNode
                      key={shard.id}
                      shard={shard}
                      isLocked={isLocked}
                      hasError={Boolean(error)}
                      reducedMotion={reducedMotion}
                      radiusScale={isMobileOrTouch ? 0.68 : 1}
                    />
                  );
                })}

                {/* Keystroke Sparks flying from the form across the divider into the V */}
                <AnimatePresence>
                  {!reducedMotion &&
                    sparks.map((spark) => (
                      <motion.span
                        key={spark.id}
                        initial={{
                          x: isMobileOrTouch ? 0 : 145,
                          y: isMobileOrTouch ? 72 : spark.startY,
                          scale: 1,
                          opacity: 0.95,
                        }}
                        animate={{
                          x: isMobileOrTouch ? [0, 12, 0] : [145, 58, 0],
                          y: isMobileOrTouch ? [72, 28, 0] : [spark.startY, spark.arcY, 0],
                          scale: [1, 0.9, 0.3],
                          opacity: [0.95, 1, 0],
                        }}
                        transition={{ duration: 0.48, ease: 'easeOut' }}
                        onAnimationComplete={() => {
                          setSparks((curr) => curr.filter((s) => s.id !== spark.id));
                          setSparkPulseKey((k) => k + 1);
                        }}
                        className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 pointer-events-none z-20"
                      >
                        <svg width="10" height="10" viewBox="0 0 12 12" fill="none">
                          <polygon points="6,1 11,10.5 1,10.5" fill={spark.color} />
                        </svg>
                      </motion.span>
                    ))}
                </AnimatePresence>

                {/* Central Venote V Mark Tile */}
                <motion.div
                  key={sparkPulseKey}
                  initial={false}
                  animate={
                    !reducedMotion && sparkPulseKey > 0
                      ? { scale: [1, 1.055, 1] }
                      : { scale: 0.94 + assembledStage * 0.02 }
                  }
                  transition={{ duration: reducedMotion ? 0 : 0.24, ease: 'easeOut' }}
                  className="relative z-10 w-20 h-20 lg:w-24 lg:h-24 rounded-3xl landing-subcard flex items-center justify-center p-3.5 lg:p-4 shadow-2xl border border-primary-accent/45"
                >
                  <Image
                    src="/brand/venote-icon.png"
                    alt=""
                    width={1146}
                    height={1155}
                    unoptimized
                    className="w-full h-full object-contain"
                  />
                </motion.div>
              </div>

              {/* 3-Step Progress Bars */}
              <div aria-hidden="true" className="flex items-center gap-1.5 mt-1 mb-2.5">
                {[1, 2, 3].map((step) => {
                  const active =
                    !error &&
                    (reducedMotion ||
                      loading ||
                      authSuccess ||
                      (step === 1 && emailValid) ||
                      (step === 2 && hasPassword));
                  return (
                    <span
                      key={step}
                      className={`h-1.5 rounded-full transition-all duration-300 ${
                        active ? 'w-6 bg-primary-accent' : 'w-2 bg-[var(--glass-border)]'
                      }`}
                    />
                  );
                })}
              </div>

              <p className="font-serif italic font-bold text-xl sm:text-2xl lg:text-[26px] text-primary-text tracking-tight leading-tight">
                Scattered thoughts.{' '}
                <span className="text-primary-accent">One place.</span>
              </p>

              {/* Live Status Line with Letter-by-Letter Reveal (<300ms) & aria-live="polite" */}
              <div className="mt-1.5">
                <LetterRevealStatus
                  text={statusLine}
                  hasError={Boolean(error)}
                  reducedMotion={reducedMotion}
                />
              </div>
            </div>

            {/* Soft Vertical Gradient Divider (Desktop) / Horizontal Divider (Mobile) */}
            <div
              aria-hidden="true"
              className="hidden lg:block w-px self-stretch bg-gradient-to-b from-transparent via-[var(--landing-edge-top)] to-transparent"
            />
            <div
              aria-hidden="true"
              className="lg:hidden h-px w-full bg-gradient-to-r from-transparent via-[var(--landing-edge-top)] to-transparent"
            />

            {/* RIGHT HALF: Auth Form with Staggered Entrance & Micro-Interactions */}
            <div className="lg:w-[55%] p-6 sm:p-8 lg:p-10 flex flex-col justify-center">
              {/* Stagger 1: Logo + Headline */}
              <motion.div
                initial={reducedMotion ? false : { opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: reducedMotion ? 0 : 0.26, delay: reducedMotion ? 0 : 0.05 }}
                className="flex flex-col items-center lg:items-start text-center lg:text-left mb-6"
              >
                <div className="flex items-center gap-3 mb-4">
                  <BrandLogo className="h-9" />
                </div>

                <AnimatePresence mode="wait" initial={false}>
                  <motion.div
                    key={isSignUp ? 'signup-heading' : 'signin-heading'}
                    initial={reducedMotion ? false : { opacity: 0, y: 4 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -4 }}
                    transition={{ duration: reducedMotion ? 0 : 0.16, ease: 'easeOut' }}
                  >
                    <h1 className="font-serif italic font-bold text-3xl sm:text-[34px] tracking-tight text-primary-text">
                      {isSignUp ? 'Create an account' : 'Welcome back'}
                    </h1>
                    <p className="text-xs sm:text-sm glass-muted mt-1">
                      {isSignUp
                        ? 'Start turning messy thoughts into structured cards.'
                        : 'Sign in to access your organized workspace.'}
                    </p>
                  </motion.div>
                </AnimatePresence>
              </motion.div>

              <form onSubmit={handleAuth} className="space-y-4">
                {isSignUp && (
                  <motion.div
                    initial={reducedMotion ? false : { opacity: 0, y: 6 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: reducedMotion ? 0 : 0.2 }}
                  >
                    <label
                      htmlFor="login-name"
                      className={`block font-mono text-[11px] uppercase tracking-wider mb-1.5 transition-all duration-200 ${
                        focusedField === 'name' || name.length > 0
                          ? 'text-primary-accent -translate-y-0.5'
                          : 'glass-muted'
                      }`}
                    >
                      Name
                    </label>
                    <div className="login-input-wrap">
                      <input
                        id="login-name"
                        type="text"
                        autoComplete="name"
                        value={name}
                        onFocus={() => setFocusedField('name')}
                        onBlur={() => setFocusedField((f) => (f === 'name' ? null : f))}
                        onChange={(e) => {
                          setName(e.target.value);
                          triggerKeystrokeSpark('name');
                        }}
                        aria-describedby={error ? 'login-auth-error' : undefined}
                        className="login-glass-input w-full h-[52px] rounded-2xl px-4 text-[16px] text-primary-text placeholder:text-[var(--glass-muted)]/60"
                        placeholder="Jane Doe"
                        required={isSignUp}
                      />
                    </div>
                  </motion.div>
                )}

                {/* Stagger 2: Email Field */}
                <motion.div
                  initial={reducedMotion ? false : { opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: reducedMotion ? 0 : 0.26, delay: reducedMotion ? 0 : 0.1 }}
                >
                  <label
                    htmlFor="login-email"
                    className={`block font-mono text-[11px] uppercase tracking-wider mb-1.5 transition-all duration-200 ${
                      focusedField === 'email' || email.length > 0
                        ? 'text-primary-accent -translate-y-0.5'
                        : 'glass-muted'
                    }`}
                  >
                    Email
                  </label>
                  <div className="login-input-wrap">
                    <input
                      id="login-email"
                      type="email"
                      inputMode="email"
                      autoComplete="email"
                      value={email}
                      onFocus={() => setFocusedField('email')}
                      onBlur={() => setFocusedField((f) => (f === 'email' ? null : f))}
                      onChange={(e) => {
                        setEmail(e.target.value);
                        triggerKeystrokeSpark('email');
                      }}
                      aria-invalid={Boolean(error)}
                      aria-describedby={error ? 'login-auth-error' : undefined}
                      className="login-glass-input w-full h-[52px] rounded-2xl px-4 text-[16px] text-primary-text placeholder:text-[var(--glass-muted)]/60"
                      placeholder="you@example.com"
                      required
                    />
                  </div>
                </motion.div>

                {/* Stagger 3: Password Field with Animated Eyelid Swipe */}
                <motion.div
                  initial={reducedMotion ? false : { opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: reducedMotion ? 0 : 0.26, delay: reducedMotion ? 0 : 0.15 }}
                >
                  <label
                    htmlFor="login-password"
                    className={`block font-mono text-[11px] uppercase tracking-wider mb-1.5 transition-all duration-200 ${
                      focusedField === 'password' || hasPassword
                        ? 'text-primary-accent -translate-y-0.5'
                        : 'glass-muted'
                    }`}
                  >
                    Password
                  </label>
                  <div className="login-input-wrap relative flex items-center">
                    <input
                      id="login-password"
                      type={showPassword ? 'text' : 'password'}
                      autoComplete={isSignUp ? 'new-password' : 'current-password'}
                      value={password}
                      onFocus={() => setFocusedField('password')}
                      onBlur={() => setFocusedField((f) => (f === 'password' ? null : f))}
                      onChange={(e) => {
                        setPassword(e.target.value);
                        triggerKeystrokeSpark('password');
                      }}
                      aria-invalid={Boolean(error)}
                      aria-describedby={error ? 'login-auth-error' : undefined}
                      className="login-glass-input w-full h-[52px] rounded-2xl pl-4 pr-12 text-[16px] text-primary-text placeholder:text-[var(--glass-muted)]/60"
                      placeholder="••••••••"
                      required
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword((prev) => !prev)}
                      aria-label={showPassword ? 'Hide password' : 'Show password'}
                      aria-pressed={showPassword}
                      className="absolute right-1.5 min-h-[44px] min-w-[44px] rounded-xl inline-flex items-center justify-center glass-muted hover:text-primary-text transition-colors focus-visible:outline-2 focus-visible:outline-primary-accent cursor-pointer"
                    >
                      <motion.svg
                        aria-hidden="true"
                        className="w-5 h-5"
                        viewBox="0 0 24 24"
                        fill="none"
                        stroke="currentColor"
                        strokeWidth="1.8"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        initial={false}
                        animate={{ scaleY: showPassword ? [0.25, 1] : [0.25, 1] }}
                        transition={{ duration: reducedMotion ? 0 : 0.18 }}
                      >
                        <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" />
                        <circle cx="12" cy="12" r="3" />
                        <motion.line
                          x1="3"
                          y1="3"
                          x2="21"
                          y2="21"
                          initial={false}
                          animate={{
                            pathLength: showPassword ? 1 : 0,
                            opacity: showPassword ? 1 : 0,
                          }}
                          transition={{ duration: reducedMotion ? 0 : 0.18 }}
                        />
                      </motion.svg>
                    </button>
                  </div>
                </motion.div>

                {/* Stagger 4: Custom Branded Glass "Remember me" Checkbox with Self-Drawing Check */}
                <motion.div
                  initial={reducedMotion ? false : { opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: reducedMotion ? 0 : 0.26, delay: reducedMotion ? 0 : 0.2 }}
                  className="pt-0.5"
                >
                  <label
                    htmlFor="rememberMe"
                    className="min-h-[44px] inline-flex items-center gap-2.5 cursor-pointer select-none group"
                  >
                    <input
                      type="checkbox"
                      id="rememberMe"
                      checked={rememberMe}
                      onChange={(e) => setRememberMe(e.target.checked)}
                      className="sr-only peer"
                    />
                    <span
                      aria-hidden="true"
                      className={`w-5 h-5 rounded-md border flex items-center justify-center transition-all peer-focus-visible:outline-2 peer-focus-visible:outline-primary-accent peer-focus-visible:outline-offset-2 ${
                        rememberMe
                          ? 'bg-primary-accent border-primary-accent text-white shadow-[0_2px_10px_rgba(255,92,56,0.35)]'
                          : 'login-glass-input group-hover:border-primary-accent/50'
                      }`}
                    >
                      <svg
                        className="w-3.5 h-3.5"
                        viewBox="0 0 16 16"
                        fill="none"
                        stroke="currentColor"
                        strokeWidth="2.4"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                      >
                        <motion.path
                          d="M3.5 8.5l3 3 6-6.5"
                          initial={false}
                          animate={{
                            pathLength: rememberMe ? 1 : 0,
                            opacity: rememberMe ? 1 : 0,
                          }}
                          transition={{ duration: reducedMotion ? 0 : 0.2, ease: 'easeOut' }}
                        />
                      </svg>
                    </span>
                    <span className="text-sm glass-muted group-hover:text-primary-text transition-colors">
                      Remember me
                    </span>
                  </label>
                </motion.div>

                {/* Inline Error Strip (role="alert", aria-live="assertive") */}
                <AnimatePresence initial={false}>
                  {error && (
                    <motion.div
                      id="login-auth-error"
                      role="alert"
                      aria-live="assertive"
                      initial={reducedMotion ? false : { opacity: 0, y: -4 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, y: -4 }}
                      transition={{ duration: reducedMotion ? 0 : 0.18 }}
                      className="p-3.5 text-sm text-red-700 dark:text-red-200 bg-red-500/12 rounded-2xl border border-red-500/35 flex items-start gap-2.5"
                    >
                      <svg
                        aria-hidden="true"
                        xmlns="http://www.w3.org/2000/svg"
                        className="h-5 w-5 text-red-500 dark:text-red-400 shrink-0 mt-0.5"
                        viewBox="0 0 20 20"
                        fill="currentColor"
                      >
                        <path
                          fillRule="evenodd"
                          d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7 4a1 1 0 11-2 0 1 1 0 012 0zm-1-9a1 1 0 00-1 1v4a1 1 0 102 0V6a1 1 0 00-1-1z"
                          clipRule="evenodd"
                        />
                      </svg>
                      <span>{error}</span>
                    </motion.div>
                  )}
                </AnimatePresence>

                {/* Stagger 5: Primary Button with Shimmer, Pointer Ripple, Loading Ring & Check Morph */}
                <motion.div
                  initial={reducedMotion ? false : { opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: reducedMotion ? 0 : 0.26, delay: reducedMotion ? 0 : 0.25 }}
                >
                  <button
                    type="submit"
                    disabled={loading}
                    aria-busy={loading}
                    onPointerDown={handlePrimaryPointerDown}
                    className={`relative overflow-hidden w-full h-[52px] bg-gradient-to-r from-[#FF5C38] to-[#FF451A] text-white font-semibold rounded-2xl hover:brightness-110 active:scale-[0.99] transition-all shadow-[0_8px_24px_0_rgba(255,92,56,0.38),inset_0_1px_0_0_rgba(255,255,255,0.28)] border border-white/15 flex justify-center items-center gap-2.5 focus-visible:outline-2 focus-visible:outline-primary-accent focus-visible:outline-offset-2 cursor-pointer ${
                      loading ? 'opacity-85 cursor-not-allowed' : ''
                    }`}
                  >
                    {/* Idle Shimmer Sweep */}
                    {!loading && !reducedMotion && (
                      <span aria-hidden="true" className="login-btn-shimmer" />
                    )}

                    {/* Pointer Press Ripple */}
                    <AnimatePresence>
                      {btnRipple && !reducedMotion && (
                        <motion.span
                          key={btnRipple.id}
                          aria-hidden="true"
                          style={{ left: btnRipple.x, top: btnRipple.y }}
                          initial={{ scale: 0, opacity: 0.45 }}
                          animate={{ scale: 2.6, opacity: 0 }}
                          exit={{ opacity: 0 }}
                          transition={{ duration: 0.5, ease: 'easeOut' }}
                          onAnimationComplete={() =>
                            setBtnRipple((curr) => (curr?.id === btnRipple.id ? null : curr))
                          }
                          className="absolute w-24 h-24 -translate-x-1/2 -translate-y-1/2 rounded-full bg-white/40 pointer-events-none"
                        />
                      )}
                    </AnimatePresence>

                    <AnimatePresence mode="wait" initial={false}>
                      {authSuccess ? (
                        <motion.span
                          key="btn-success"
                          initial={reducedMotion ? false : { opacity: 0, scale: 0.85 }}
                          animate={{ opacity: 1, scale: 1 }}
                          exit={{ opacity: 0 }}
                          transition={{ duration: reducedMotion ? 0 : 0.18 }}
                          className="relative z-10 inline-flex items-center gap-2"
                        >
                          <svg
                            aria-hidden="true"
                            className="w-5 h-5 text-white"
                            viewBox="0 0 20 20"
                            fill="none"
                            stroke="currentColor"
                            strokeWidth="2.5"
                            strokeLinecap="round"
                            strokeLinejoin="round"
                          >
                            <path d="M4 10.5l4 4 8-8.5" />
                          </svg>
                          <span>Welcome in</span>
                        </motion.span>
                      ) : loading ? (
                        <motion.span
                          key="btn-loading"
                          initial={reducedMotion ? false : { opacity: 0, scale: 0.9 }}
                          animate={{ opacity: 1, scale: 1 }}
                          exit={{ opacity: 0 }}
                          transition={{ duration: reducedMotion ? 0 : 0.16 }}
                          className="relative z-10 inline-flex items-center gap-2.5"
                        >
                          <svg
                            aria-hidden="true"
                            className="animate-spin h-5 w-5 text-white shrink-0"
                            xmlns="http://www.w3.org/2000/svg"
                            fill="none"
                            viewBox="0 0 24 24"
                          >
                            <circle
                              className="opacity-25"
                              cx="12"
                              cy="12"
                              r="10"
                              stroke="currentColor"
                              strokeWidth="4"
                            />
                            <path
                              className="opacity-75"
                              fill="currentColor"
                              d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
                            />
                          </svg>
                          <span>{isSignUp ? 'Creating account...' : 'Signing in...'}</span>
                        </motion.span>
                      ) : (
                        <motion.span
                          key="btn-idle"
                          initial={reducedMotion ? false : { opacity: 0 }}
                          animate={{ opacity: 1 }}
                          exit={{ opacity: 0 }}
                          transition={{ duration: reducedMotion ? 0 : 0.14 }}
                          className="relative z-10"
                        >
                          {isSignUp ? 'Sign Up' : 'Sign In'}
                        </motion.span>
                      )}
                    </AnimatePresence>
                  </button>
                </motion.div>
              </form>

              {/* Stagger 6: Mode Switch + Divider + Google Button */}
              <motion.div
                initial={reducedMotion ? false : { opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: reducedMotion ? 0 : 0.26, delay: reducedMotion ? 0 : 0.3 }}
              >
                <div className="mt-4 text-center text-sm glass-muted">
                  <span>{isSignUp ? 'Already have an account?' : "Don't have an account?"}</span>
                  <button
                    type="button"
                    onClick={() => {
                      setIsSignUp(!isSignUp);
                      setError(null);
                    }}
                    className="min-h-[44px] px-2 ml-1 text-primary-accent hover:underline font-semibold transition-colors focus-visible:outline-2 focus-visible:outline-primary-accent rounded cursor-pointer"
                  >
                    {isSignUp ? 'Sign in' : 'Sign up'}
                  </button>
                </div>

                <div className="my-4 flex items-center gap-4">
                  <div className="h-px flex-1 bg-gradient-to-r from-transparent via-[var(--landing-edge-side)] to-[var(--landing-edge-top)]" />
                  <span className="font-mono text-xs uppercase tracking-widest glass-muted">
                    or
                  </span>
                  <div className="h-px flex-1 bg-gradient-to-l from-transparent via-[var(--landing-edge-side)] to-[var(--landing-edge-top)]" />
                </div>

                {/* Continue with Google Glass Button with Cursor Light Sweep */}
                <button
                  type="button"
                  onClick={handleGoogleLogin}
                  onMouseMove={handleGoogleMouseMove}
                  disabled={loading}
                  className="login-google-btn w-full h-[52px] flex items-center justify-center gap-3 landing-subcard hover:border-primary-accent/50 text-primary-text font-semibold px-4 rounded-2xl transition-all active:scale-[0.99] focus-visible:outline-2 focus-visible:outline-primary-accent disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer"
                >
                  <svg
                    aria-hidden="true"
                    width="20"
                    height="20"
                    viewBox="0 0 48 48"
                    fill="none"
                    xmlns="http://www.w3.org/2000/svg"
                    className="relative z-10 shrink-0"
                  >
                    <path
                      d="M47.532 24.5528C47.532 22.9214 47.3997 21.2811 47.1175 19.6761H24.48V28.9181H37.4434C36.9055 31.8988 35.177 34.5356 32.6461 36.2111V42.2078H40.3801C44.9217 38.0278 47.532 31.8547 47.532 24.5528Z"
                      fill="#4285F4"
                    />
                    <path
                      d="M24.48 48.0016C30.9529 48.0016 36.4116 45.8764 40.3888 42.2078L32.6549 36.2111C30.5031 37.675 27.7252 38.5039 24.4888 38.5039C18.2275 38.5039 12.9187 34.2798 11.0139 28.6006H3.03296V34.7825C7.10718 42.8868 15.4056 48.0016 24.48 48.0016Z"
                      fill="#34A853"
                    />
                    <path
                      d="M11.0051 28.6006C9.99973 25.6199 9.99973 22.3922 11.0051 19.4115V13.2296H3.03298C-0.371021 20.0112 -0.371021 28.0009 3.03298 34.7825L11.0051 28.6006Z"
                      fill="#FBBC04"
                    />
                    <path
                      d="M24.48 9.49932C27.9016 9.44641 31.2086 10.7339 33.6866 13.0973L40.5387 6.24523C36.2 2.17101 30.4414 -0.068932 24.48 0.00161733C15.4055 0.00161733 7.10718 5.11644 3.03296 13.2296L11.005 19.4115C12.901 13.7235 18.2187 9.49932 24.48 9.49932Z"
                      fill="#EA4335"
                    />
                  </svg>
                  <span className="relative z-10">Continue with Google</span>
                </button>
              </motion.div>
            </div>
          </motion.div>
        </motion.div>
      </main>

      <div aria-hidden="true" className="h-2" />
    </div>
  );
}
