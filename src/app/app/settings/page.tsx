'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { supabase } from '@/lib/supabase';
import AppSidebar from '@/components/AppSidebar';
import AppMobileHeader from '@/components/AppMobileHeader';

export default function SettingsPage() {
  const [session, setSession] = useState<any>(null);
  const [authLoading, setAuthLoading] = useState(true);
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  
  // Settings State
  const [currency, setCurrency] = useState('auto');
  const [defaultView, setDefaultView] = useState('/app');
  
  // UI State
  const [toastMessage, setToastMessage] = useState('');
  const [isDeleting, setIsDeleting] = useState(false);
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [deleteConfirmText, setDeleteConfirmText] = useState('');

  const router = useRouter();

  // Auth & Settings Fetch
  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
      if (!session) router.push('/login');
      else fetchUserSettings(session.user.id);
      setAuthLoading(false);
    });
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setSession(session);
      if (!session) router.push('/login');
      else fetchUserSettings(session.user.id);
    });
    return () => subscription.unsubscribe();
  }, [router]);

  const fetchUserSettings = async (userId: string) => {
    const { data } = await supabase.from('user_settings').select('currency, default_view').eq('user_id', userId).single();
    if (data) {
      if (data.currency) setCurrency(data.currency);
      if (data.default_view) setDefaultView(data.default_view);
    }
  };

  const showToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(''), 3000);
  };

  const handleUpdateCurrency = async (val: string) => {
    setCurrency(val);
    if (!session) return;
    await supabase.from('user_settings').upsert({ user_id: session.user.id, currency: val }, { onConflict: 'user_id' });
    showToast('Currency preference saved');
  };

  const handleUpdateDefaultView = async (val: string) => {
    setDefaultView(val);
    if (!session) return;
    await supabase.from('user_settings').upsert({ user_id: session.user.id, default_view: val }, { onConflict: 'user_id' });
    showToast('Default view saved');
  };

  const handleResetPassword = async () => {
    if (!session?.user?.email) return;
    const { error } = await supabase.auth.resetPasswordForEmail(session.user.email);
    if (error) showToast('Failed to send reset link');
    else showToast('Password reset link sent to email');
  };

  const handleSignOut = async () => {
    await supabase.auth.signOut();
    router.push('/login');
  };

  const handleDeleteData = async () => {
    if (deleteConfirmText !== 'DELETE' || !session) return;
    setIsDeleting(true);
    try {
      const userId = session.user.id;
      const tables = ['entries', 'expenses', 'income', 'job_applications', 'application_rounds', 'prep_sessions', 'quick_notes', 'schedule_blocks', 'category_budgets', 'user_settings'];
      
      // Delete from all tables for user
      await Promise.all(tables.map(async (table) => {
        await supabase.from(table).delete().eq('user_id', userId);
      }));

      await supabase.auth.signOut();
      router.push('/');
    } catch (err) {
      console.error(err);
      showToast('Error deleting data');
      setIsDeleting(false);
      setShowDeleteModal(false);
    }
  };

  if (authLoading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="w-8 h-8 border-4 border-primary-accent border-t-transparent rounded-full animate-spin"></div>
      </div>
    );
  }

  const provider = session?.user?.app_metadata?.provider || 'email';
  const isGoogle = provider === 'google';

  return (
    <div className="flex h-[100dvh] md:h-screen bg-background overflow-hidden font-sans text-primary-text selection:bg-primary-accent/30 selection:text-primary-text relative">
      {/* Toast */}
      {toastMessage && (
        <div className="absolute top-4 right-4 z-50 glass-panel border border-primary-accent/40 text-primary-text px-4 py-2 rounded-xl shadow-lg transition-opacity animate-in fade-in slide-in-from-top-2">
          {toastMessage}
        </div>
      )}

      <AppSidebar 
        activePath="/app/settings" 
        isMobileMenuOpen={isMobileMenuOpen} 
        onCloseMenu={() => setIsMobileMenuOpen(false)} 
        session={session} 
      />

      <main className="flex-1 overflow-y-auto flex flex-col w-full min-w-0">
        <AppMobileHeader onOpenMenu={() => setIsMobileMenuOpen(true)} />

        <div className="flex-1 flex flex-col items-center p-4 py-8 md:px-8 md:py-16">
          <div className="w-full max-w-2xl flex flex-col items-start space-y-12">
            
            <div className="w-full mb-2">
              <h1 className="font-serif italic font-bold text-4xl md:text-[40px] tracking-tight leading-[1.1] text-primary-text mb-3">
                Settings
              </h1>
              <p className="text-muted-text">
                Manage your account and preferences.
              </p>
            </div>

            {/* Account Section */}
            <section className="w-full">
              <h2 className="text-xl font-serif italic font-bold text-primary-text mb-4 border-b border-white/10 pb-2">Account</h2>
              <div className="flex flex-col gap-4">
                <div className="glass-panel p-5 rounded-2xl border border-white/5 flex flex-col gap-1">
                  <span className="text-xs font-mono uppercase tracking-widest text-muted-text">Email</span>
                  <span className="text-lg text-primary-text">{session?.user?.email}</span>
                  <span className="text-sm text-primary-accent/80 mt-1">Signed in with {isGoogle ? 'Google' : 'Email'}</span>
                </div>

                <div className="flex gap-3">
                  {!isGoogle && (
                    <button 
                      onClick={handleResetPassword}
                      className="px-4 py-2 rounded-xl glass-panel-subtle text-primary-text border border-white/10 hover:bg-white/5 transition-colors text-sm font-medium"
                    >
                      Change Password
                    </button>
                  )}
                  <button 
                    onClick={handleSignOut}
                    className="px-4 py-2 rounded-xl glass-panel-subtle text-primary-text border border-white/10 hover:bg-white/5 transition-colors text-sm font-medium"
                  >
                    Sign Out
                  </button>
                </div>
              </div>
            </section>

            {/* Preferences Section */}
            <section className="w-full">
              <h2 className="text-xl font-serif italic font-bold text-primary-text mb-4 border-b border-white/10 pb-2">Preferences</h2>
              <div className="flex flex-col gap-6">
                
                {/* Default View */}
                <div className="glass-panel p-5 rounded-2xl border border-white/5 flex flex-col gap-3">
                  <div>
                    <span className="block text-sm font-medium text-primary-text mb-1">Default Landing Page</span>
                    <span className="block text-xs text-muted-text">Choose which page opens when you log in or click the logo.</span>
                  </div>
                  <div className="relative w-full md:w-64">
                    <select
                      value={defaultView || '/app'}
                      onChange={(e) => handleUpdateDefaultView(e.target.value)}
                      className="appearance-none bg-black/50 border border-white/10 rounded-xl pl-3 pr-9 py-2 text-sm text-primary-text outline-none focus:border-primary-accent/50 transition-colors w-full"
                    >
                      <option value="/app">Organize</option>
                      <option value="/app/this-week">Dashboard</option>
                      <option value="/app/schedule">Schedule</option>
                      <option value="/app/expenses">Wallet</option>
                      <option value="/app/rounds">Job</option>
                    </select>
                    <svg xmlns="http://www.w3.org/2000/svg" className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-text" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                    </svg>
                  </div>
                </div>

                {/* Currency */}
                <div className="glass-panel p-5 rounded-2xl border border-white/5 flex flex-col gap-3">
                  <div>
                    <span className="block text-sm font-medium text-primary-text mb-1">Wallet Currency</span>
                    <span className="block text-xs text-muted-text">Set your preferred currency symbol for expenses and incomes.</span>
                  </div>
                  <div className="relative w-full md:w-64">
                    <select
                      value={currency || 'auto'}
                      onChange={(e) => handleUpdateCurrency(e.target.value)}
                      className="appearance-none bg-black/50 border border-white/10 rounded-xl pl-3 pr-9 py-2 text-sm text-primary-text outline-none focus:border-primary-accent/50 transition-colors w-full"
                    >
                      <option value="auto">Auto (Locale Default)</option>
                      <option value="USD">USD ($)</option>
                      <option value="EUR">EUR (€)</option>
                      <option value="GBP">GBP (£)</option>
                      <option value="JPY">JPY (¥)</option>
                      <option value="CAD">CAD ($)</option>
                      <option value="AUD">AUD ($)</option>
                      <option value="INR">INR (₹)</option>
                    </select>
                    <svg xmlns="http://www.w3.org/2000/svg" className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-text" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                    </svg>
                  </div>
                </div>
                
              </div>
            </section>

            {/* Danger Zone */}
            <section className="w-full">
              <div className="flex flex-col gap-4">

                <div className="glass-panel p-5 rounded-2xl border border-red-500/20 bg-red-500/5 flex flex-col md:flex-row md:items-center justify-between gap-4">
                  <div className="flex flex-col gap-1">
                    <span className="text-sm font-medium text-red-400">Delete All My Data</span>
                    <span className="text-xs text-red-400/70">Permanently delete all your entries, transactions, jobs, and settings.</span>
                  </div>
                  <button 
                    onClick={() => setShowDeleteModal(true)}
                    className="shrink-0 px-4 py-2 rounded-xl bg-red-500/20 text-red-400 border border-red-500/20 hover:bg-red-500/30 transition-colors text-sm font-medium"
                  >
                    Delete Data
                  </button>
                </div>

              </div>
            </section>

          </div>
        </div>
      </main>

      {/* Delete Confirmation Modal */}
      {showDeleteModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
          <div className="glass-panel-modal max-w-md w-full rounded-3xl p-6 border border-white/10 shadow-2xl flex flex-col gap-4 animate-in fade-in zoom-in-95">
            <h3 className="text-xl font-serif italic font-bold text-red-500">Confirm Deletion</h3>
            <p className="text-sm text-primary-text">
              This will permanently delete all your data across Flowspace. Your account login will remain active, but all content will be wiped. This action <strong>cannot be undone</strong>.
            </p>
            <p className="text-sm text-muted-text">
              Type <strong className="text-red-400">DELETE</strong> to confirm.
            </p>
            <input
              type="text"
              value={deleteConfirmText}
              onChange={(e) => setDeleteConfirmText(e.target.value)}
              placeholder="DELETE"
              className="w-full bg-black/50 border border-white/10 rounded-xl px-4 py-3 text-sm text-primary-text outline-none focus:border-red-500/50 transition-colors"
            />
            <div className="flex justify-end gap-3 mt-2">
              <button
                onClick={() => {
                  setShowDeleteModal(false);
                  setDeleteConfirmText('');
                }}
                className="px-4 py-2 text-sm text-muted-text hover:text-primary-text transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={handleDeleteData}
                disabled={deleteConfirmText !== 'DELETE' || isDeleting}
                className="px-4 py-2 text-sm bg-red-500 text-white rounded-xl font-medium hover:bg-red-600 disabled:opacity-50 disabled:cursor-not-allowed shadow-[0_4px_14px_0_rgba(239,68,68,0.39)] transition-all"
              >
                {isDeleting ? 'Deleting...' : 'Permanently Delete'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
