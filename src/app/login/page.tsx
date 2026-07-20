'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { supabase } from '@/lib/supabase';

export default function Login() {
  const [isSignUp, setIsSignUp] = useState(false);
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [rememberMe, setRememberMe] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const router = useRouter();

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
        const { error } = await supabase.auth.signUp({
          email,
          password,
          options: {
            data: {
              name,
            },
          },
        });
        if (error) throw error;
        // On success, redirect to home
        router.push('/app');
      } else {
        const { error } = await supabase.auth.signInWithPassword({
          email,
          password,
        });
        if (error) throw error;
        // On success, redirect to home
        router.push('/app');
      }
    } catch (err: any) {
      setError(err.message || 'An error occurred during authentication.');
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
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-background text-primary-text flex items-center justify-center font-sans px-4">
      <div className="w-full max-w-md bg-card border border-hairline rounded-2xl p-8 shadow-2xl relative">
        <div className="flex flex-col items-center mb-8">
          <div className="flex items-center gap-3 mb-6">
            <svg width="40" height="40" viewBox="0 0 32 32" fill="none" xmlns="http://www.w3.org/2000/svg">
              <rect width="32" height="32" rx="8" fill="url(#logo-grad)"/>
              <defs>
                <linearGradient id="logo-grad" x1="0" y1="0" x2="32" y2="32" gradientUnits="userSpaceOnUse">
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
            <span className="font-serif italic font-bold text-[40px] tracking-tight leading-none pt-1 text-[#F5EDD9]">Venote</span>
          </div>
          <h1 className="font-serif italic font-bold text-3xl tracking-tight">
            {isSignUp ? 'Create an account' : 'Welcome back'}
          </h1>
        </div>

        <form onSubmit={handleAuth} className="space-y-4">
          {isSignUp && (
            <div>
              <label className="block text-sm text-muted-text mb-1.5 font-medium">Name</label>
              <input
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                className="w-full bg-background border border-hairline rounded-xl px-4 py-3 text-primary-text focus:outline-none focus:border-primary-accent transition-colors"
                placeholder="Jane Doe"
                required={isSignUp}
              />
            </div>
          )}
          <div>
            <label className="block text-sm text-muted-text mb-1.5 font-medium">Email</label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="w-full bg-background border border-hairline rounded-xl px-4 py-3 text-primary-text focus:outline-none focus:border-primary-accent transition-colors"
              placeholder="you@example.com"
              required
            />
          </div>
          <div>
            <label className="block text-sm text-muted-text mb-1.5 font-medium">Password</label>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="w-full bg-background border border-hairline rounded-xl px-4 py-3 text-primary-text focus:outline-none focus:border-primary-accent transition-colors"
              placeholder="••••••••"
              required
            />
          </div>

          <div className="flex items-center gap-2 mt-2">
            <input
              type="checkbox"
              id="rememberMe"
              checked={rememberMe}
              onChange={(e) => setRememberMe(e.target.checked)}
              className="w-4 h-4 rounded border-hairline bg-background text-primary-accent focus:ring-primary-accent focus:ring-offset-background"
            />
            <label htmlFor="rememberMe" className="text-sm text-muted-text cursor-pointer select-none">
              Remember me
            </label>
          </div>

          {error && (
            <div className="p-3 text-sm text-red-300 bg-red-950/40 rounded-xl border border-red-900/50 flex items-start gap-2">
              <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 shrink-0 mt-0.5" viewBox="0 0 20 20" fill="currentColor">
                <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7 4a1 1 0 11-2 0 1 1 0 012 0zm-1-9a1 1 0 00-1 1v4a1 1 0 102 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
              </svg>
              <span>{error}</span>
            </div>
          )}

          <button
            type="submit"
            disabled={loading}
            className={`w-full py-3.5 bg-primary-accent text-primary-text font-medium rounded-xl hover:brightness-110 transition-all shadow-[0_4px_14px_0_rgba(255,92,56,0.39)] mt-6 flex justify-center items-center ${
              loading ? 'opacity-70 cursor-not-allowed' : ''
            }`}
          >
            {loading ? (
              <svg className="animate-spin h-5 w-5" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
              </svg>
            ) : (
              isSignUp ? 'Sign Up' : 'Sign In'
            )}
          </button>
        </form>

          <div className="mt-6 text-center text-sm text-muted-text">
            {isSignUp ? "Already have an account?" : "Don't have an account?"}
            <button
              type="button"
              onClick={() => setIsSignUp(!isSignUp)}
              className="ml-2 text-primary-accent hover:text-primary-text font-semibold transition-colors focus:outline-none"
            >
              {isSignUp ? 'Sign in' : 'Sign up'}
            </button>
          </div>

          <div className="mt-6 flex items-center before:mt-0.5 before:flex-1 before:border-t before:border-hairline after:mt-0.5 after:flex-1 after:border-t after:border-hairline">
            <span className="mx-4 mb-0 text-center text-sm text-muted-text">or</span>
          </div>

          <button
            type="button"
            onClick={handleGoogleLogin}
            disabled={loading}
            className="mt-6 w-full flex items-center justify-center gap-3 bg-background border border-hairline hover:bg-white/5 text-primary-text font-bold py-3 px-4 rounded-xl transition-all focus:outline-none disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <svg width="20" height="20" viewBox="0 0 48 48" fill="none" xmlns="http://www.w3.org/2000/svg">
              <path d="M47.532 24.5528C47.532 22.9214 47.3997 21.2811 47.1175 19.6761H24.48V28.9181H37.4434C36.9055 31.8988 35.177 34.5356 32.6461 36.2111V42.2078H40.3801C44.9217 38.0278 47.532 31.8547 47.532 24.5528Z" fill="#4285F4"/>
              <path d="M24.48 48.0016C30.9529 48.0016 36.4116 45.8764 40.3888 42.2078L32.6549 36.2111C30.5031 37.675 27.7252 38.5039 24.4888 38.5039C18.2275 38.5039 12.9187 34.2798 11.0139 28.6006H3.03296V34.7825C7.10718 42.8868 15.4056 48.0016 24.48 48.0016Z" fill="#34A853"/>
              <path d="M11.0051 28.6006C9.99973 25.6199 9.99973 22.3922 11.0051 19.4115V13.2296H3.03298C-0.371021 20.0112 -0.371021 28.0009 3.03298 34.7825L11.0051 28.6006Z" fill="#FBBC04"/>
              <path d="M24.48 9.49932C27.9016 9.44641 31.2086 10.7339 33.6866 13.0973L40.5387 6.24523C36.2 2.17101 30.4414 -0.068932 24.48 0.00161733C15.4055 0.00161733 7.10718 5.11644 3.03296 13.2296L11.005 19.4115C12.901 13.7235 18.2187 9.49932 24.48 9.49932Z" fill="#EA4335"/>
            </svg>
            Continue with Google
          </button>
      </div>
    </div>
  );
}
