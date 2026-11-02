'use client';

import { useEffect, useRef, useState, type MouseEvent } from 'react';
import Image from 'next/image';
import Link from 'next/link';
import { AnimatePresence, motion, useReducedMotion, useScroll, useSpring } from 'framer-motion';

type NavSectionId = 'features' | 'how-it-works' | 'download';

const NAV_LINKS: { id: NavSectionId; label: string; href: string }[] = [
  { id: 'features', label: 'Features', href: '#features' },
  { id: 'how-it-works', label: 'How it works', href: '#how-it-works' },
  { id: 'download', label: 'Download', href: '#download' },
];

const LOGO_SCATTER_SHARDS = [
  { dx: -9, dy: -8, rot: -24, color: '#FF5C38' },
  { dx: 11, dy: -7, rot: 28, color: '#E8B86D' },
  { dx: -10, dy: 8, rot: 18, color: '#8B5CF6' },
  { dx: 10, dy: 9, rot: -20, color: '#FF5C38' },
] as const;

export default function LandingNav() {
  const reducedMotion = useReducedMotion();
  const wrapperRef = useRef<HTMLDivElement>(null);
  const menuBtnRef = useRef<HTMLButtonElement>(null);

  const [scrolled, setScrolled] = useState(false);
  const [hidden, setHidden] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const [focusWithin, setFocusWithin] = useState(false);
  const [logoHovered, setLogoHovered] = useState(false);
  const [activeSection, setActiveSection] = useState<NavSectionId | null>('features');
  const [hoveredLink, setHoveredLink] = useState<NavSectionId | null>(null);

  // Page scroll progress bar along bottom edge of pill (transform scaleX only)
  const { scrollYProgress } = useScroll();
  const smoothProgress = useSpring(scrollYProgress, {
    stiffness: 180,
    damping: 28,
    restDelta: 0.001,
  });

  // Condense after ~24px & hide on fast downward scroll / show on upward scroll
  useEffect(() => {
    let lastY = window.scrollY;
    let ticking = false;

    const updateScroll = () => {
      const y = window.scrollY;
      const delta = y - lastY;

      setScrolled(y > 24);

      if (y <= 64 || menuOpen || focusWithin || reducedMotion) {
        setHidden(false);
      } else if (delta > 10 && y > 110) {
        setHidden(true);
      } else if (delta < -6) {
        setHidden(false);
      }

      lastY = y;
      ticking = false;
    };

    const onScroll = () => {
      if (!ticking) {
        window.requestAnimationFrame(updateScroll);
        ticking = true;
      }
    };

    updateScroll();
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, [menuOpen, focusWithin, reducedMotion]);

  // Ensure nav is visible whenever menu opens or focus enters
  useEffect(() => {
    if (menuOpen || focusWithin) {
      setHidden(false);
    }
  }, [menuOpen, focusWithin]);

  // Scroll-spy with IntersectionObserver on section ids
  useEffect(() => {
    if (typeof IntersectionObserver === 'undefined') return;
    const elements = NAV_LINKS.map((item) => document.getElementById(item.id)).filter(
      (el): el is HTMLElement => Boolean(el)
    );
    if (elements.length === 0) return;

    const observer = new IntersectionObserver(
      (entries) => {
        const visible = entries
          .filter((entry) => entry.isIntersecting)
          .sort((a, b) => b.intersectionRatio - a.intersectionRatio);
        if (visible[0]?.target?.id) {
          setActiveSection(visible[0].target.id as NavSectionId);
        }
      },
      {
        rootMargin: '-20% 0px -55% 0px',
        threshold: [0.1, 0.25, 0.5],
      }
    );

    elements.forEach((el) => observer.observe(el));
    return () => observer.disconnect();
  }, []);

  // Close mobile sheet on Escape, outside click, and trap focus while open
  useEffect(() => {
    if (!menuOpen) return;

    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.preventDefault();
        setMenuOpen(false);
        menuBtnRef.current?.focus();
        return;
      }

      if (e.key === 'Tab' && wrapperRef.current) {
        const focusables = Array.from(
          wrapperRef.current.querySelectorAll<HTMLElement>(
            'a[href], button:not([disabled]), [tabindex]:not([tabindex="-1"])'
          )
        ).filter((el) => el.offsetParent !== null);

        if (focusables.length === 0) return;
        const first = focusables[0];
        const last = focusables[focusables.length - 1];

        if (e.shiftKey && document.activeElement === first) {
          e.preventDefault();
          last.focus();
        } else if (!e.shiftKey && document.activeElement === last) {
          e.preventDefault();
          first.focus();
        }
      }
    };

    const onPointerDown = (e: PointerEvent) => {
      if (wrapperRef.current && !wrapperRef.current.contains(e.target as Node)) {
        setMenuOpen(false);
      }
    };

    const onResize = () => {
      if (window.innerWidth >= 768) {
        setMenuOpen(false);
      }
    };

    document.addEventListener('keydown', onKeyDown);
    document.addEventListener('pointerdown', onPointerDown);
    window.addEventListener('resize', onResize);
    return () => {
      document.removeEventListener('keydown', onKeyDown);
      document.removeEventListener('pointerdown', onPointerDown);
      window.removeEventListener('resize', onResize);
    };
  }, [menuOpen]);

  const handleAnchorClick = (e: MouseEvent<HTMLAnchorElement>, id: NavSectionId) => {
    const target = document.getElementById(id);
    setActiveSection(id);
    setMenuOpen(false);
    if (!target) return;

    e.preventDefault();
    const stickyOffset = 92;
    const top = target.getBoundingClientRect().top + window.scrollY - stickyOffset;
    window.scrollTo({
      top: Math.max(0, top),
      behavior: reducedMotion ? 'auto' : 'smooth',
    });
    window.history.replaceState(null, '', `#${id}`);
  };

  const highlightedId = hoveredLink ?? activeSection;
  const shouldHide = hidden && !menuOpen && !focusWithin && !reducedMotion;

  return (
    <header className="fixed top-4 inset-x-0 z-50 px-4 pointer-events-none flex justify-center">
      <motion.div
        ref={wrapperRef}
        initial={false}
        animate={{
          y: shouldHide ? -96 : 0,
          scale: scrolled && !reducedMotion ? 0.985 : 1,
        }}
        transition={{
          duration: reducedMotion ? 0 : 0.24,
          ease: [0.22, 1, 0.36, 1],
        }}
        onFocusCapture={() => setFocusWithin(true)}
        onBlurCapture={(e) => {
          if (!e.currentTarget.contains(e.relatedTarget as Node | null)) {
            setFocusWithin(false);
          }
        }}
        className="pointer-events-auto w-full max-w-[900px] will-change-transform"
      >
        <nav
          aria-label="Main"
          data-scrolled={scrolled ? 'true' : 'false'}
          className={`landing-nav-pill rounded-full w-full flex items-center justify-between gap-2 overflow-hidden transition-[padding] duration-200 ${
            scrolled ? 'px-3 sm:px-4 py-1.5' : 'px-3.5 sm:px-5 py-2'
          }`}
        >
          {/* Left: Brand Logo Tile + Wordmark with Hover Shard Scatter */}
          <Link
            href="/"
            aria-label="Venote home"
            onMouseEnter={() => setLogoHovered(true)}
            onMouseLeave={() => setLogoHovered(false)}
            className="group relative flex items-center gap-2.5 min-h-[44px] px-1.5 rounded-full shrink-0 focus-visible:outline-2 focus-visible:outline-primary-accent"
          >
            <span className="relative flex items-center justify-center w-8 h-8 shrink-0">
              {/* Decorative Scatter Shards on Hover */}
              {!reducedMotion &&
                LOGO_SCATTER_SHARDS.map((shard, i) => (
                  <motion.span
                    key={i}
                    aria-hidden="true"
                    initial={false}
                    animate={
                      logoHovered
                        ? {
                            x: [0, shard.dx, 0],
                            y: [0, shard.dy, 0],
                            rotate: [0, shard.rot, 0],
                            opacity: [0, 0.9, 0],
                            scale: [0.6, 1, 0.6],
                          }
                        : { x: 0, y: 0, rotate: 0, opacity: 0, scale: 0.6 }
                    }
                    transition={{ duration: 0.48, ease: 'easeOut' }}
                    className="absolute w-1.5 h-1.5 rounded-sm pointer-events-none"
                    style={{ backgroundColor: shard.color }}
                  />
                ))}

              <Image
                src="/brand/venote-icon.png"
                alt=""
                width={1146}
                height={1155}
                unoptimized
                className="block h-7 w-auto object-contain relative z-10"
              />
            </span>

            <span className="max-[359px]:hidden font-serif italic font-bold text-xl sm:text-2xl tracking-tight leading-none text-primary-text">
              Venote
            </span>
          </Link>

          {/* Center: Desktop Links with Shared Sliding Glass Highlight + Scroll-Spy */}
          <div
            className="hidden md:flex items-center gap-1 relative p-1 rounded-full"
            onMouseLeave={() => setHoveredLink(null)}
          >
            {NAV_LINKS.map((link) => {
              const isActive = activeSection === link.id;
              const isHighlighted = highlightedId === link.id;
              return (
                <a
                  key={link.id}
                  href={link.href}
                  aria-current={isActive ? 'true' : undefined}
                  onMouseEnter={() => setHoveredLink(link.id)}
                  onFocus={() => setHoveredLink(link.id)}
                  onClick={(e) => handleAnchorClick(e, link.id)}
                  className={`relative z-10 min-h-[40px] px-4 py-1.5 inline-flex items-center justify-center rounded-full font-sans text-sm font-medium transition-colors focus-visible:outline-2 focus-visible:outline-primary-accent ${
                    isHighlighted
                      ? 'text-primary-text'
                      : 'text-primary-text/80 hover:text-primary-text'
                  }`}
                >
                  {isHighlighted && (
                    <motion.span
                      aria-hidden="true"
                      layoutId={reducedMotion ? undefined : 'landing-nav-pill-highlight'}
                      initial={false}
                      transition={{
                        type: 'spring',
                        stiffness: 380,
                        damping: 32,
                        duration: reducedMotion ? 0 : undefined,
                      }}
                      className="absolute inset-0 -z-10 rounded-full landing-subcard border border-primary-accent/30 bg-primary-accent/10"
                    />
                  )}
                  <span>{link.label}</span>
                </a>
              );
            })}
          </div>

          {/* Right: Quiet Sign In + Dominant Primary Get Started + Mobile Menu Toggle */}
          <div className="flex items-center gap-1.5 sm:gap-2 shrink-0">
            <Link
              href="/login"
              className="hidden md:inline-flex min-h-[40px] items-center justify-center px-3.5 py-1.5 rounded-full font-sans text-sm font-medium text-primary-text/80 hover:text-primary-text hover:bg-[var(--landing-glass-subcard)] transition-colors focus-visible:outline-2 focus-visible:outline-primary-accent"
            >
              Sign In
            </Link>

            <Link
              href="/login"
              className="min-h-[44px] md:min-h-[40px] inline-flex items-center justify-center px-4 sm:px-5 py-2 rounded-full bg-gradient-to-r from-[#FF5C38] to-[#FF451A] text-white font-sans text-xs sm:text-sm font-semibold hover:brightness-110 active:scale-95 transition-all shadow-[0_4px_18px_rgba(255,92,56,0.38),inset_0_1px_0_rgba(255,255,255,0.28)] border border-white/15 focus-visible:outline-2 focus-visible:outline-primary-accent focus-visible:outline-offset-2 whitespace-nowrap"
            >
              Get started
            </Link>

            {/* Mobile 44px Menu Button */}
            <button
              ref={menuBtnRef}
              type="button"
              aria-label={menuOpen ? 'Close navigation menu' : 'Open navigation menu'}
              aria-expanded={menuOpen}
              aria-controls="landing-mobile-sheet"
              onClick={() => setMenuOpen((prev) => !prev)}
              className="md:hidden min-h-[44px] min-w-[44px] inline-flex items-center justify-center rounded-full landing-subcard text-primary-text hover:border-primary-accent/45 transition-colors focus-visible:outline-2 focus-visible:outline-primary-accent cursor-pointer"
            >
              <svg
                aria-hidden="true"
                className="w-5 h-5"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                {menuOpen ? (
                  <path d="M18 6L6 18M6 6l12 12" />
                ) : (
                  <path d="M4 7h16M4 12h16M4 17h16" />
                )}
              </svg>
            </button>
          </div>

          {/* Thin Accent Scroll Progress Line along bottom edge */}
          <motion.span
            aria-hidden="true"
            style={{
              scaleX: reducedMotion ? scrollYProgress : smoothProgress,
              transformOrigin: '0% 50%',
            }}
            className="pointer-events-none absolute bottom-0 left-3 right-3 h-[2px] rounded-full bg-gradient-to-r from-[#FF5C38] via-[#E8B86D] to-[#8B5CF6] opacity-85"
          />
        </nav>

        {/* Mobile Glass Sheet under the Pill */}
        <AnimatePresence>
          {menuOpen && (
            <motion.div
              id="landing-mobile-sheet"
              role="dialog"
              aria-label="Mobile navigation menu"
              initial={reducedMotion ? false : { opacity: 0, y: -8, scale: 0.98 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: -6, scale: 0.98 }}
              transition={{ duration: reducedMotion ? 0 : 0.18, ease: 'easeOut' }}
              style={{
                paddingLeft: 'max(12px, env(safe-area-inset-left))',
                paddingRight: 'max(12px, env(safe-area-inset-right))',
              }}
              className="md:hidden mt-2 landing-glass-shell rounded-[24px] py-3 flex flex-col gap-1"
            >
              {NAV_LINKS.map((link) => {
                const isActive = activeSection === link.id;
                return (
                  <a
                    key={link.id}
                    href={link.href}
                    aria-current={isActive ? 'true' : undefined}
                    onClick={(e) => handleAnchorClick(e, link.id)}
                    className={`min-h-12 px-4 rounded-xl flex items-center justify-between font-sans text-base font-medium transition-colors focus-visible:outline-2 focus-visible:outline-primary-accent ${
                      isActive
                        ? 'bg-primary-accent/15 text-primary-text font-semibold border border-primary-accent/35'
                        : 'text-primary-text/85 hover:text-primary-text hover:bg-[var(--landing-glass-subcard)]'
                    }`}
                  >
                    <span>{link.label}</span>
                    <span aria-hidden="true" className="font-mono text-xs glass-muted">
                      ↗
                    </span>
                  </a>
                );
              })}

              <div className="h-px bg-[var(--glass-hairline)] my-1" />

              <Link
                href="/login"
                onClick={() => setMenuOpen(false)}
                className="min-h-12 px-4 rounded-xl flex items-center justify-between font-sans text-base font-semibold text-primary-text landing-subcard hover:border-primary-accent/45 transition-colors focus-visible:outline-2 focus-visible:outline-primary-accent"
              >
                <span>Sign In</span>
                <span aria-hidden="true" className="font-mono text-xs text-primary-accent">
                  →
                </span>
              </Link>
            </motion.div>
          )}
        </AnimatePresence>
      </motion.div>
    </header>
  );
}

