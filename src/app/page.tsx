'use client';

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
    <div className="flex flex-col items-center gap-6 w-full max-w-2xl mt-4">
      {/* Main Web App CTA */}
      <Link 
        href="/login"
        className="px-10 py-4 bg-gradient-to-r from-[#FF5C38] to-[#FF451A] text-white font-bold rounded-2xl hover:brightness-110 active:scale-[0.98] transition-all shadow-[0_8px_28px_0_rgba(255,92,56,0.4),inset_0_1px_0_0_rgba(255,255,255,0.25)] text-xl w-full sm:w-auto text-center border border-white/15"
      >
        Get Started in Browser
      </Link>

      <div className="flex items-center gap-4 w-full">
        <div className="h-px bg-white/10 flex-1"></div>
        <span className="text-muted-text text-xs font-mono uppercase tracking-widest">or download app</span>
        <div className="h-px bg-white/10 flex-1"></div>
      </div>

      <div className="flex flex-col sm:flex-row items-center justify-center gap-4 w-full">
        <a
          href="https://github.com/vkprofessional1031-svg/Venote/releases/download/v1.0.0/Venote-1.0.0-arm64.dmg"
          download
          className={`w-full sm:w-auto px-6 py-3.5 rounded-2xl font-medium transition-all flex items-center justify-center gap-2 border shadow-lg ${
            detectedOS === 'mac' || detectedOS === 'other'
              ? 'glass-panel glass-panel-interactive border-white/15 hover:border-primary-accent/50 text-primary-text'
              : 'glass-panel-subtle border-white/5 text-muted-text hover:text-primary-text'
          }`}
        >
          <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
            <path fillRule="evenodd" d="M3 17a1 1 0 011-1h12a1 1 0 110 2H4a1 1 0 01-1-1zm3.293-7.707a1 1 0 011.414 0L9 10.586V3a1 1 0 112 0v7.586l1.293-1.293a1 1 0 111.414 1.414l-3 3a1 1 0 01-1.414 0l-3-3a1 1 0 010-1.414z" clipRule="evenodd" />
          </svg>
          Download for Mac
        </a>
        
        <a
          href="https://github.com/vkprofessional1031-svg/Venote/releases/download/v1.0.0/Venote.Setup.1.0.0.exe"
          download
          className={`w-full sm:w-auto px-6 py-3.5 rounded-2xl font-medium transition-all flex items-center justify-center gap-2 border shadow-lg ${
            detectedOS === 'windows'
              ? 'glass-panel glass-panel-interactive border-white/15 hover:border-primary-accent/50 text-primary-text'
              : 'glass-panel-subtle border-white/5 text-muted-text hover:text-primary-text'
          }`}
        >
          <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
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
    <div className="min-h-screen bg-[#0E0C0B] text-primary-text font-sans selection:bg-primary-accent selection:text-white relative overflow-hidden">
      {/* Background ambient orbs for refraction */}
      <div 
        aria-hidden="true" 
        className="fixed top-[-10%] left-[20%] w-[500px] h-[500px] rounded-full pointer-events-none -z-10" 
        style={{ background: 'radial-gradient(circle, rgba(255,92,56,0.15) 0%, transparent 70%)' }}
      />
      <div 
        aria-hidden="true" 
        className="fixed bottom-[10%] right-[10%] w-[600px] h-[600px] rounded-full pointer-events-none -z-10" 
        style={{ background: 'radial-gradient(circle, rgba(139,92,246,0.15) 0%, transparent 70%)' }}
      />

      {/* Navigation */}
      <nav className="fixed top-0 left-0 right-0 h-20 glass-nav z-50 flex items-center justify-between px-6 md:px-12">
        <div className="flex items-center gap-3">
          <svg width="32" height="32" viewBox="0 0 32 32" fill="none" xmlns="http://www.w3.org/2000/svg">
            <rect width="32" height="32" rx="8" fill="url(#logo-grad-nav)"/>
            <defs>
              <linearGradient id="logo-grad-nav" x1="0" y1="0" x2="32" y2="32" gradientUnits="userSpaceOnUse">
                <stop stopColor="#FF6B3D"/>
                <stop offset="1" stopColor="#FF3B1D"/>
              </linearGradient>
            </defs>
            <path d="M14.5 22.5L9 11.5H13L16 18L21 9H25L17.5 22.5H14.5Z" fill="white"/>
            <circle cx="8" cy="14" r="1.5" fill="white"/>
            <circle cx="10" cy="20" r="1" fill="white"/>
            <circle cx="7" cy="18" r="1" fill="white"/>
            <polygon points="10,8 13,10 9,11" fill="white"/>
            <polygon points="8,21 12,23 9,24" fill="white"/>
            <polygon points="12,14 15,16 12,17" fill="white"/>
          </svg>
          <span className="font-serif italic font-bold text-2xl tracking-tight leading-none pt-1">Venote</span>
        </div>
        <div>
          <Link 
            href="/login" 
            className="text-sm font-medium text-primary-text glass-panel-subtle hover:bg-white/10 border border-white/10 px-5 py-2.5 rounded-xl transition-all shadow-sm active:scale-95"
          >
            Sign In
          </Link>
        </div>
      </nav>

      {/* Hero Section */}
      <main className="pt-36 pb-24 px-6 md:px-12 max-w-5xl mx-auto flex flex-col items-center text-center mt-10 md:mt-16 relative">
        {/* Subtle Ambient Glow */}
        <div 
          aria-hidden="true" 
          className="ambient-glow-hero"
        />

        <div className="relative z-10 flex flex-col items-center">
          <h1 className="font-serif italic font-bold text-5xl md:text-7xl lg:text-8xl tracking-tight leading-[1.1] mb-8 drop-shadow-sm">
            What's on your mind?<br />
            <span className="text-primary-accent">We'll organize it.</span>
          </h1>
          <p className="text-lg md:text-xl text-[#A6988D] max-w-2xl mb-8 leading-relaxed font-normal">
            Type, speak, or brain dump anything. Our AI automatically turns your messy thoughts into beautifully structured tasks, notes, tables, and roadmaps.
          </p>
          <ActionButtons />
        </div>
      </main>

      {/* Feature Highlights */}
      <section className="py-24 px-6 md:px-12 border-y border-white/5 relative overflow-hidden bg-white/[0.01]">
        {/* Ambient background refraction glow */}
        <div 
          aria-hidden="true" 
          className="absolute top-1/2 left-1/4 -translate-y-1/2 w-[450px] h-[350px] rounded-full pointer-events-none" 
          style={{ background: 'radial-gradient(circle, rgba(232,184,109,0.12) 0%, transparent 70%)' }}
        />
        <div 
          aria-hidden="true" 
          className="absolute bottom-1/4 right-1/4 w-[400px] h-[300px] rounded-full pointer-events-none" 
          style={{ background: 'radial-gradient(circle, rgba(255,92,56,0.12) 0%, transparent 70%)' }}
        />

        <div className="max-w-6xl mx-auto relative z-10">
          <div className="text-center mb-16 md:mb-20">
            <h2 className="font-serif italic font-bold text-4xl md:text-5xl tracking-tight mb-4">Focus on thinking, not sorting.</h2>
            <p className="text-[#A6988D] max-w-xl mx-auto text-base md:text-lg">Venote handles the tedious part of note-taking by instantly giving structure to your brain dumps.</p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 md:gap-8">
            
            {/* Feature 1 */}
            <div className="glass-panel glass-panel-interactive rounded-[24px] p-8 md:p-10 shadow-2xl relative overflow-hidden flex flex-col">
              <div className="w-12 h-12 rounded-2xl bg-tertiary-accent/15 border border-tertiary-accent/30 flex items-center justify-center mb-6 text-tertiary-accent shadow-inner">
                <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" />
                </svg>
              </div>
              <h3 className="font-sans font-bold text-2xl mb-3 text-primary-text">AI-Powered Structuring</h3>
              <p className="text-[#A6988D] leading-relaxed text-base">
                Just start typing. Our engine instantly analyzes your input and formats it into actionable checklists, rich contextual notes, or clean data tables.
              </p>
            </div>

            {/* Feature 2 */}
            <div className="glass-panel glass-panel-interactive rounded-[24px] p-8 md:p-10 shadow-2xl relative overflow-hidden flex flex-col">
              <div className="w-12 h-12 rounded-2xl bg-[#1D9E75]/15 border border-[#1D9E75]/30 flex items-center justify-center mb-6 text-[#1D9E75] shadow-inner">
                <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6" />
                </svg>
              </div>
              <h3 className="font-sans font-bold text-2xl mb-3 text-primary-text">Dynamic Roadmaps</h3>
              <p className="text-[#A6988D] leading-relaxed text-base">
                Need a plan? Ask for a roadmap and watch it generate an interactive, winding SVG journey to help you track milestones toward your final goal.
              </p>
            </div>

            {/* Feature 3 */}
            <div className="glass-panel glass-panel-interactive rounded-[24px] p-8 md:p-10 shadow-2xl relative overflow-hidden flex flex-col">
              <div className="w-12 h-12 rounded-2xl bg-secondary-accent/15 border border-secondary-accent/30 flex items-center justify-center mb-6 text-secondary-accent shadow-inner">
                <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M3 10h18M7 15h1m4 0h1m-7 4h12a3 3 0 003-3V8a3 3 0 00-3-3H6a3 3 0 00-3 3v8a3 3 0 003 3z" />
                </svg>
              </div>
              <h3 className="font-sans font-bold text-2xl mb-3 text-primary-text">Smart Wallet</h3>
              <p className="text-[#A6988D] leading-relaxed text-base">
                Set category budgets with visual limits, track split bills to see who owes you what, and get AI-generated summaries of your spending patterns.
              </p>
            </div>

            {/* Feature 4 */}
            <div className="glass-panel glass-panel-interactive rounded-[24px] p-8 md:p-10 shadow-2xl relative overflow-hidden flex flex-col">
              <div className="w-12 h-12 rounded-2xl bg-primary-accent/15 border border-primary-accent/30 flex items-center justify-center mb-6 text-primary-accent shadow-inner">
                <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M19 11a7 7 0 01-7 7m0 0a7 7 0 01-7-7m7 7v4m0 0H8m4 0h4m-4-8a3 3 0 01-3-3V5a3 3 0 116 0v6a3 3 0 01-3 3z" />
                </svg>
              </div>
              <h3 className="font-sans font-bold text-2xl mb-3 text-primary-text">Voice Input</h3>
              <p className="text-[#A6988D] leading-relaxed text-base">
                Sometimes typing is too slow. Use our built-in speech recognition to instantly transcribe your brainstorms right into the app.
              </p>
            </div>

            {/* Feature 5 */}
            <div className="glass-panel glass-panel-interactive rounded-[24px] p-8 md:p-10 shadow-2xl relative overflow-hidden flex flex-col md:col-span-2 md:w-[calc(50%-1rem)] md:mx-auto">
              <div className="w-12 h-12 rounded-2xl bg-[#8B5CF6]/15 border border-[#8B5CF6]/30 flex items-center justify-center mb-6 text-[#8B5CF6] shadow-inner">
                <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M21 13.255A23.931 23.931 0 0112 15c-3.183 0-6.22-.62-9-1.745M16 6V4a2 2 0 00-2-2h-4a2 2 0 00-2 2v2m4 6h.01M5 20h14a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
                </svg>
              </div>
              <h3 className="font-sans font-bold text-2xl mb-3 text-primary-text">Interview Prep</h3>
              <p className="text-[#A6988D] leading-relaxed text-base">
                Track job applications through multiple rounds and see upcoming deadlines in a dedicated "Due Soon" view. AI automatically parses your updates.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* CTA Section */}
      <section className="py-28 px-6 text-center flex flex-col items-center relative">
        <div 
          aria-hidden="true" 
          className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[500px] h-[300px] rounded-full pointer-events-none" 
          style={{ background: 'radial-gradient(circle, rgba(255,92,56,0.15) 0%, transparent 70%)' }}
        />
        <div className="relative z-10 flex flex-col items-center">
          <h2 className="font-serif italic font-bold text-4xl md:text-5xl tracking-tight mb-8">Ready to clear your mind?</h2>
          <ActionButtons />
        </div>
      </section>
      
      <footer className="border-t border-white/5 py-8 text-center text-muted-text text-sm glass-panel-subtle">
        &copy; {new Date().getFullYear()} Venote. All rights reserved.
      </footer>
    </div>
  );
}
