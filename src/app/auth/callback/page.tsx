'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { supabase } from '@/lib/supabase';

export default function AuthCallback() {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let mounted = true;

    const checkSession = async () => {
      // Check for explicit error in URL first
      const hash = window.location.hash;
      const searchParams = new URLSearchParams(window.location.search);
      
      if (searchParams.get('error') || hash.includes('error=')) {
        if (mounted) {
          setError(searchParams.get('error_description') || 'An error occurred during authentication.');
          setTimeout(() => router.push('/login'), 3000);
        }
        return;
      }

      // The Supabase client automatically handles the OAuth callback and PKCE verification
      // when it initializes in the browser and detects the code/access_token in the URL.
      // We manually check getSession() in case the onAuthStateChange event already fired.
      const { data } = await supabase.auth.getSession();
      if (data.session && mounted) {
        router.push('/app');
      }
    };

    checkSession();

    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      if ((event === 'SIGNED_IN' || session) && mounted) {
        router.push('/app');
      }
    });

    // Fallback: if after 3 seconds we don't have a session and no error, redirect to login
    // just in case the OAuth flow failed silently or the user navigated here directly.
    const timeout = setTimeout(async () => {
      const { data } = await supabase.auth.getSession();
      if (data.session && mounted) {
        router.push('/app');
      } else if (mounted) {
        router.push('/login');
      }
    }, 3000);

    return () => {
      mounted = false;
      subscription.unsubscribe();
      clearTimeout(timeout);
    };
  }, [router]);

  return (
    <div className="min-h-screen bg-background flex flex-col items-center justify-center font-sans">
      {error ? (
        <div className="text-center space-y-4">
          <div className="text-red-400 font-medium">{error}</div>
          <div className="text-sm text-muted-text">Redirecting you back...</div>
        </div>
      ) : (
        <div className="flex flex-col items-center space-y-6">
          <svg className="animate-spin h-8 w-8 text-primary-accent" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
          </svg>
          <div className="text-primary-text font-serif italic tracking-tight text-xl animate-pulse">
            Authenticating...
          </div>
        </div>
      )}
    </div>
  );
}
