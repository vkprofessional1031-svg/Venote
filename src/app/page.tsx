'use client';

import BrandLogo from '@/components/BrandLogo';
import AuroraBackground from '@/components/landing/AuroraBackground';
import LandingNav from '@/components/landing/LandingNav';
import HeroLiveDemo from '@/components/landing/HeroLiveDemo';
import LogoAssemblyScroll from '@/components/landing/LogoAssemblyScroll';
import RouterBeamSection from '@/components/landing/RouterBeamSection';
import FeatureBento from '@/components/landing/FeatureBento';
import HowItWorks from '@/components/landing/HowItWorks';
import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { supabase } from '@/lib/supabase';

export default function LandingPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [detectedOS, setDetectedOS] = useState<'mac' | 'windows' | 'other'>('other');

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (session) {
        router.replace('/app');
      } else {
        setLoading(false);
      }
    });

    const platform = window.navigator.platform.toLowerCase();
    const userAgent = window.navigator.userAgent.toLowerCase();
    if (platform.includes('mac') || userAgent.includes('mac')) {
      setDetectedOS('mac');
    } else if (platform.includes('win') || userAgent.includes('win')) {
      setDetectedOS('windows');
    }
  }, [router]);

  const ActionButtons = () => (
    <div className="flex flex-col items-center gap-6 w-full max-w-2xl mt-2">
      {/* Main Web App CTA */}
      <Link
        href="/login"
        className="min-h-[48px] px-10 py-4 bg-gradient-to-r from-[#FF5C38] to-[#FF451A] text-white font-bold rounded-2xl hover:brightness-110 active:scale-[0.98] transition-all shadow-[0_8px_28px_0_rgba(255,92,56,0.4),inset_0_1px_0_0_rgba(255,255,255,0.25)] text-lg sm:text-xl w-full sm:w-auto text-center border border-white/15 focus-visible:outline-2 focus-visible:outline-primary-accent focus-visible:outline-offset-2"
      >
        Get Started in Browser
      </Link>

      <div className="flex items-center gap-4 w-full">
        <div className="h-px bg-[var(--glass-hairline)] flex-1" />
        <span className="glass-muted text-xs font-mono uppercase tracking-widest">or download app</span>
        <div className="h-px bg-[var(--glass-hairline)] flex-1" />
      </div>

      <div className="flex flex-col sm:flex-row items-center justify-center gap-3.5 sm:gap-4 w-full">
        <a
          href="https://github.com/vkprofessional1031-svg/Venote/releases/download/v1.0.0/Venote-1.0.0-arm64.dmg"
          download
          className={`min-h-[48px] w-full sm:w-auto px-6 py-3.5 rounded-2xl font-medium transition-all flex items-center justify-center gap-2 border shadow-lg focus-visible:outline-2 focus-visible:outline-primary-accent focus-visible:outline-offset-2 ${
            detectedOS === 'mac' || detectedOS === 'other'
              ? 'landing-bento-card border-primary-accent/35 text-primary-text'
              : 'landing-subcard glass-muted hover:text-primary-text'
          }`}
        >
          <svg aria-hidden="true" xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 shrink-0" viewBox="0 0 20 20" fill="currentColor">
            <path fillRule="evenodd" d="M3 17a1 1 0 011-1h12a1 1 0 110 2H4a1 1 0 01-1-1zm3.293-7.707a1 1 0 011.414 0L9 10.586V3a1 1 0 112 0v7.586l1.293-1.293a1 1 0 111.414 1.414l-3 3a1 1 0 01-1.414 0l-3-3a1 1 0 010-1.414z" clipRule="evenodd" />
          </svg>
          Download for Mac
        </a>

        <a
          href="https://github.com/vkprofessional1031-svg/Venote/releases/download/v1.0.0/Venote.Setup.1.0.0.exe"
          download
          className={`min-h-[48px] w-full sm:w-auto px-6 py-3.5 rounded-2xl font-medium transition-all flex items-center justify-center gap-2 border shadow-lg focus-visible:outline-2 focus-visible:outline-primary-accent focus-visible:outline-offset-2 ${
            detectedOS === 'windows'
              ? 'landing-bento-card border-primary-accent/35 text-primary-text'
              : 'landing-subcard glass-muted hover:text-primary-text'
          }`}
        >
          <svg aria-hidden="true" xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 shrink-0" viewBox="0 0 20 20" fill="currentColor">
            <path fillRule="evenodd" d="M3 17a1 1 0 011-1h12a1 1 0 110 2H4a1 1 0 01-1-1zm3.293-7.707a1 1 0 011.414 0L9 10.586V3a1 1 0 112 0v7.586l1.293-1.293a1 1 0 111.414 1.414l-3 3a1 1 0 01-1.414 0l-3-3a1 1 0 010-1.414z" clipRule="evenodd" />
          </svg>
          Download for Windows
        </a>
      </div>
    </div>
  );

  if (loading) {
    return <div className="min-h-screen bg-background flex items-center justify-center text-primary-text"></div>;
  }

  return (
    <div className="min-h-screen bg-background text-primary-text font-sans selection:bg-primary-accent selection:text-white relative overflow-x-clip">
      <AuroraBackground />

      {/* Floating Glass Pill Navigation (16px from top) */}
      <LandingNav />

      {/* Main Content */}
      <main>
        {/* Hero Section */}
        <section className="pt-32 sm:pt-36 pb-16 md:pb-24 px-4 sm:px-6 md:px-12 max-w-5xl mx-auto flex flex-col items-center text-center relative">
          <div aria-hidden="true" className="ambient-glow-hero" />

          <div className="relative z-10 flex flex-col items-center w-full">
            <span className="font-mono text-xs uppercase tracking-widest px-3.5 py-1.5 rounded-full landing-subcard glass-muted mb-6">
              Messy thoughts → Structured glass cards
            </span>

            <h1 className="font-serif italic font-bold text-4xl sm:text-6xl md:text-7xl lg:text-8xl tracking-tight leading-[1.08] mb-6 drop-shadow-sm">
              What&apos;s on your mind?
              <br />
              <span className="text-primary-accent">We&apos;ll organize it.</span>
            </h1>

            <p className="text-base sm:text-lg md:text-xl glass-muted max-w-2xl mb-8 leading-relaxed font-normal">
              Type, speak, or brain dump anything. Our AI automatically turns your messy thoughts into beautifully structured tasks, notes, tables, and roadmaps.
            </p>

            {/* Code-Built Animated Hero Live Demo */}
            <HeroLiveDemo />

            {/* CTA Buttons below the Demo */}
            <ActionButtons />
          </div>
        </section>

        {/* Pinned Scroll Scene: Scattered Shards Converge into Venote V Mark */}
        <LogoAssemblyScroll />

        {/* Interactive Router Beam Section */}
        <RouterBeamSection />

        {/* Glass Bento Features Section */}
        <section
          id="features"
          aria-labelledby="features-heading"
          className="scroll-mt-24 py-20 md:py-24 px-4 sm:px-6 md:px-12 relative"
        >
          <div className="max-w-6xl mx-auto relative z-10">
            <div className="text-center mb-12 md:mb-16">
              <span className="font-mono text-xs uppercase tracking-widest px-3 py-1 rounded-full landing-subcard glass-muted inline-block mb-3">
                Five tools in one workspace
              </span>
              <h2
                id="features-heading"
                className="font-serif italic font-bold text-3xl sm:text-4xl md:text-5xl tracking-tight mb-4 text-primary-text"
              >
                Focus on thinking, not sorting.
              </h2>
              <p className="glass-muted max-w-xl mx-auto text-base md:text-lg">
                Venote handles the tedious part of note-taking by instantly giving structure to your brain dumps.
              </p>
            </div>

            <FeatureBento />
          </div>
        </section>

        {/* How It Works Strip */}
        <HowItWorks />

        {/* Final Glass CTA & Download Section */}
        <section
          id="download"
          aria-labelledby="final-cta-heading"
          className="scroll-mt-24 py-20 md:py-28 px-4 sm:px-6 md:px-12 relative"
        >
          <div className="max-w-4xl mx-auto relative">
            <div
              aria-hidden="true"
              className="absolute inset-0 -z-10 rounded-[32px] blur-3xl opacity-30 pointer-events-none"
              style={{
                background:
                  'radial-gradient(circle at 35% 50%, rgba(255,92,56,0.45), rgba(139,92,246,0.25) 60%, transparent 80%)',
              }}
            />
            <div className="landing-glass-shell rounded-[32px] px-6 py-12 sm:p-14 md:p-16 text-center flex flex-col items-center relative overflow-hidden">
              <h2
                id="final-cta-heading"
                className="font-serif italic font-bold text-3xl sm:text-4xl md:text-5xl tracking-tight mb-6 text-primary-text"
              >
                Ready to clear your mind?
              </h2>
              <ActionButtons />
            </div>
          </div>
        </section>
      </main>

      {/* Minimal Glass Footer */}
      <footer className="border-t border-hairline py-8 px-4 sm:px-6 md:px-12 glass-panel-subtle">
        <div className="max-w-6xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-4 text-sm glass-muted">
          <div className="flex items-center gap-3">
            <BrandLogo variant="icon" className="h-6" />
            <span>&copy; {new Date().getFullYear()} Venote. All rights reserved.</span>
          </div>
          <div className="flex flex-wrap items-center justify-center gap-2 sm:gap-4">
            <a
              href="#features"
              className="min-h-[44px] px-2 inline-flex items-center hover:text-primary-text transition-colors focus-visible:outline-2 focus-visible:outline-primary-accent rounded-lg"
            >
              Features
            </a>
            <a
              href="#how-it-works"
              className="min-h-[44px] px-2 inline-flex items-center hover:text-primary-text transition-colors focus-visible:outline-2 focus-visible:outline-primary-accent rounded-lg"
            >
              How it works
            </a>
            <Link
              href="/login"
              className="min-h-[44px] px-2 inline-flex items-center hover:text-primary-text transition-colors focus-visible:outline-2 focus-visible:outline-primary-accent rounded-lg"
            >
              Sign In
            </Link>
          </div>
        </div>
      </footer>
    </div>
  );
}
