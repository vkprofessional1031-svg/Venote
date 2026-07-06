'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { supabase } from '@/lib/supabase';

export default function LandingPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (session) {
        router.replace('/app');
      } else {
        setLoading(false);
      }
    });
  }, [router]);

  if (loading) {
    return <div className="min-h-screen bg-background flex items-center justify-center text-primary-text"></div>;
  }

  return (
    <div className="min-h-screen bg-background text-primary-text font-sans selection:bg-primary-accent selection:text-white">
      {/* Navigation */}
      <nav className="fixed top-0 left-0 right-0 h-20 border-b border-hairline/50 bg-background/80 backdrop-blur-md z-50 flex items-center justify-between px-6 md:px-12">
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
          <Link href="/login" className="text-sm font-medium hover:text-primary-accent transition-colors">
            Sign In
          </Link>
        </div>
      </nav>

      {/* Hero Section */}
      <main className="pt-32 pb-20 px-6 md:px-12 max-w-5xl mx-auto flex flex-col items-center text-center mt-10 md:mt-20">
        <div className="inline-block mb-6 px-3 py-1 rounded-full bg-primary-accent/10 border border-primary-accent/20 text-primary-accent font-mono text-xs font-bold tracking-widest uppercase">
          AI-Powered Organization
        </div>
        <h1 className="font-serif italic font-bold text-5xl md:text-7xl lg:text-8xl tracking-tight leading-[1.1] mb-8">
          What's on your mind?<br />
          <span className="text-primary-accent">We'll organize it.</span>
        </h1>
        <p className="text-lg md:text-xl text-muted-text max-w-2xl mb-12 leading-relaxed">
          Type, speak, or brain dump anything. Our AI automatically turns your messy thoughts into beautifully structured tasks, notes, tables, and roadmaps.
        </p>
        <Link 
          href="/login"
          className="px-8 py-4 bg-primary-accent text-white font-medium rounded-2xl hover:brightness-110 transition-all shadow-[0_8px_24px_0_rgba(255,92,56,0.3)] text-lg"
        >
          Get Started
        </Link>
      </main>

      {/* Feature Highlights */}
      <section className="py-24 px-6 md:px-12 bg-card border-y border-hairline relative overflow-hidden">
        <div className="max-w-6xl mx-auto">
          <div className="text-center mb-16 md:mb-24">
            <h2 className="font-serif italic font-bold text-4xl md:text-5xl tracking-tight mb-4">Focus on thinking, not sorting.</h2>
            <p className="text-muted-text max-w-xl mx-auto">Venote handles the tedious part of note-taking by instantly giving structure to your brain dumps.</p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-8 md:gap-12">
            
            {/* Feature 1 */}
            <div className="bg-background border border-hairline rounded-[24px] p-8 md:p-10 shadow-xl hover:border-primary-accent/30 transition-colors">
              <div className="w-12 h-12 rounded-xl bg-tertiary-accent/10 flex items-center justify-center mb-6 text-tertiary-accent">
                <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" />
                </svg>
              </div>
              <h3 className="font-sans font-bold text-2xl mb-3">AI-Powered Structuring</h3>
              <p className="text-muted-text leading-relaxed">
                Just start typing. Our engine instantly analyzes your input and formats it into actionable checklists, rich contextual notes, or clean data tables.
              </p>
            </div>

            {/* Feature 2 */}
            <div className="bg-background border border-hairline rounded-[24px] p-8 md:p-10 shadow-xl hover:border-[#1D9E75]/30 transition-colors">
              <div className="w-12 h-12 rounded-xl bg-[#1D9E75]/10 flex items-center justify-center mb-6 text-[#1D9E75]">
                <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6" />
                </svg>
              </div>
              <h3 className="font-sans font-bold text-2xl mb-3">Dynamic Roadmaps</h3>
              <p className="text-muted-text leading-relaxed">
                Need a plan? Ask for a roadmap and watch it generate an interactive, winding SVG journey to help you track milestones toward your final goal.
              </p>
            </div>

            {/* Feature 3 */}
            <div className="bg-background border border-hairline rounded-[24px] p-8 md:p-10 shadow-xl hover:border-secondary-accent/30 transition-colors">
              <div className="w-12 h-12 rounded-xl bg-secondary-accent/10 flex items-center justify-center mb-6 text-secondary-accent">
                <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M7 7h.01M7 3h5c.512 0 1.024.195 1.414.586l7 7a2 2 0 010 2.828l-7 7a2 2 0 01-2.828 0l-7-7A1.994 1.994 0 013 12V7a4 4 0 014-4z" />
                </svg>
              </div>
              <h3 className="font-sans font-bold text-2xl mb-3">Tagging & Pinning</h3>
              <p className="text-muted-text leading-relaxed">
                Keep your workspace pristine. Add custom tags for fast filtering and pin your most important thoughts to the top of your sidebar.
              </p>
            </div>

            {/* Feature 4 */}
            <div className="bg-background border border-hairline rounded-[24px] p-8 md:p-10 shadow-xl hover:border-primary-accent/30 transition-colors">
              <div className="w-12 h-12 rounded-xl bg-primary-accent/10 flex items-center justify-center mb-6 text-primary-accent">
                <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M19 11a7 7 0 01-7 7m0 0a7 7 0 01-7-7m7 7v4m0 0H8m4 0h4m-4-8a3 3 0 01-3-3V5a3 3 0 116 0v6a3 3 0 01-3 3z" />
                </svg>
              </div>
              <h3 className="font-sans font-bold text-2xl mb-3">Voice Input</h3>
              <p className="text-muted-text leading-relaxed">
                Sometimes typing is too slow. Use our built-in speech recognition to instantly transcribe your brainstorms right into the app.
              </p>
            </div>

          </div>
        </div>
      </section>

      {/* CTA Section */}
      <section className="py-24 px-6 text-center">
        <h2 className="font-serif italic font-bold text-4xl md:text-5xl tracking-tight mb-8">Ready to clear your mind?</h2>
        <Link 
          href="/login"
          className="inline-block px-10 py-4 bg-primary-accent text-white font-bold rounded-2xl hover:brightness-110 transition-all shadow-[0_8px_24px_0_rgba(255,92,56,0.3)] text-lg"
        >
          Get Started For Free
        </Link>
      </section>
      
      <footer className="border-t border-hairline py-8 text-center text-muted-text text-sm">
        &copy; {new Date().getFullYear()} Venote. All rights reserved.
      </footer>
    </div>
  );
}
