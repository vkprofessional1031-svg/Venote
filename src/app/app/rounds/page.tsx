'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { supabase } from '@/lib/supabase';
import { insertPrepItems, recalculateApplicationStatus } from '@/utils/prep';
import AppSidebar from '@/components/AppSidebar';
import AppMobileHeader from '@/components/AppMobileHeader';

interface JobApplication {
  id: string;
  company: string;
  role: string;
  source: string | null;
  applied_date: string | null;
  notes: string | null;
  job_url: string | null;
  status: string;
  status_manually_set: boolean;
  rounds: ApplicationRound[];
}

interface ApplicationRound {
  id: string;
  application_id: string;
  round_name: string;
  deadline: string | null;
  status: string;
  notes: string | null;
}

interface PrepSession {
  id: string;
  prep_type: string;
  count_or_duration: string | null;
  date: string;
  company_reference: string | null;
}

export default function RoundsPage() {
  const router = useRouter();
  const [session, setSession] = useState<any>(null);
  const [authLoading, setAuthLoading] = useState(true);
  const [loading, setLoading] = useState(true);
  
  // Data State
  const [applications, setApplications] = useState<JobApplication[]>([]);
  const [prepSessions, setPrepSessions] = useState<PrepSession[]>([]);

  // UI State
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [isMounted, setIsMounted] = useState(false);
  const [inputMode, setInputMode] = useState<'quick' | 'manual'>('quick');
  const [manualType, setManualType] = useState<'application' | 'round' | 'prep'>('application');

  // AI Quick Add state
  const [aiInput, setAiInput] = useState('');
  const [isProcessing, setIsProcessing] = useState(false);
  const [aiError, setAiError] = useState('');

  // Inline editing state for Table View
  const [editingCell, setEditingCell] = useState<{ appId: string; field: string } | null>(null);
  const [editingValue, setEditingValue] = useState('');

  // Status dropdown floating state
  const [statusDropdownState, setStatusDropdownState] = useState<{
    appId: string;
    top: number;
    left: number;
  } | null>(null);

  // Manual Form States
  const [manualApp, setManualApp] = useState({ company: '', role: '', source: '', applied_date: '', notes: '', job_url: '' });
  const [manualRound, setManualRound] = useState({ application_id: '', round_name: '', deadline_date: '', deadline_time: '', status: 'upcoming', notes: '' });
  const [manualPrep, setManualPrep] = useState({ prep_type: '', count_or_duration: '', application_id: '', date: new Date().toISOString().split('T')[0], notes: '' });

  useEffect(() => {
    setIsMounted(true);
  }, []);

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
      setAuthLoading(false);
      if (!session) router.push('/login');
    });

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setSession(session);
      if (!session) router.push('/login');
    });

    return () => subscription.unsubscribe();
  }, [router]);

  const fetchData = async () => {
    if (authLoading || !session) return;
    try {
      setLoading(true);
      // Fetch applications with their rounds
      const { data: appsData, error: appsError } = await supabase
        .from('job_applications')
        .select('*, rounds:application_rounds(*)');

      if (appsError) throw appsError;

      // Fetch prep sessions
      const { data: prepData, error: prepError } = await supabase
        .from('prep_sessions')
        .select('*')
        .order('date', { ascending: false });

      if (prepError) throw prepError;

      // Sort rounds by date (earliest first) within applications
      const formattedApps = (appsData || []).map(app => {
        app.rounds.sort((a: any, b: any) => {
          if (!a.deadline) return 1;
          if (!b.deadline) return -1;
          return new Date(a.deadline).getTime() - new Date(b.deadline).getTime();
        });
        return app;
      });

      // Sort applications by most recently added round or created_at
      formattedApps.sort((a, b) => {
        const aLatest = a.rounds.length > 0 ? a.rounds[a.rounds.length - 1].created_at : a.created_at;
        const bLatest = b.rounds.length > 0 ? b.rounds[b.rounds.length - 1].created_at : b.created_at;
        return new Date(bLatest).getTime() - new Date(aLatest).getTime();
      });

      setApplications(formattedApps);
      setPrepSessions(prepData || []);
    } catch (error) {
      console.error('Error fetching rounds data:', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, [authLoading, session]);

  const handleAiSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!aiInput.trim() || isProcessing) return;

    setIsProcessing(true);
    setAiError('');

    try {
      const res = await fetch('/api/rounds-structure', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text: aiInput }),
      });

      const data = await res.json();
      
      if (!res.ok) {
        if (res.status === 429) {
          setAiError("You've hit the AI rate limit. Please wait a minute.");
          return;
        }
        throw new Error(data.error || 'Failed to process input');
      }

      if (!data.results || !Array.isArray(data.results) || data.results.length === 0) {
        setAiError("Could not understand that. Try being more specific about the company, round, or prep session.");
        return;
      }

      const results = data.results;
      
      await insertPrepItems(results, session.user.id, supabase);

      // Refresh data
      const { data: appsData } = await supabase.from('job_applications').select('*, rounds:application_rounds(*)');
      const { data: prepData } = await supabase.from('prep_sessions').select('*').order('date', { ascending: false });
      
      if (appsData) {
        const formattedApps = appsData.map(app => {
          app.rounds.sort((a: any, b: any) => {
            if (!a.deadline) return 1;
            if (!b.deadline) return -1;
            return new Date(a.deadline).getTime() - new Date(b.deadline).getTime();
          });
          return app;
        });
        
        formattedApps.sort((a, b) => {
          const aLatest = a.rounds.length > 0 ? a.rounds[a.rounds.length - 1].created_at : a.created_at;
          const bLatest = b.rounds.length > 0 ? b.rounds[b.rounds.length - 1].created_at : b.created_at;
          return new Date(bLatest).getTime() - new Date(aLatest).getTime();
        });
        setApplications(formattedApps);
      }
      
      if (prepData) setPrepSessions(prepData);

      setAiInput('');
    } catch (err) {
      console.error('Error processing AI input:', err);
      setAiError('Failed to process. Please try again or use a simpler prompt.');
    } finally {
      setIsProcessing(false);
    }
  };

  const handleManualAppSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!manualApp.company || !manualApp.role) return;
    try {
      const { error } = await supabase.from('job_applications').insert({
        user_id: session.user.id,
        company: manualApp.company,
        role: manualApp.role,
        source: manualApp.source || null,
        applied_date: manualApp.applied_date || null,
        notes: manualApp.notes || null,
        job_url: manualApp.job_url || null,
      });
      if (error) throw error;
      setManualApp({ company: '', role: '', source: '', applied_date: '', notes: '', job_url: '' });
      await fetchData();
    } catch (error) {
      console.error('Error inserting manual application:', error);
    }
  };

  const handleManualRoundSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!manualRound.application_id || !manualRound.round_name) return;
    try {
      let dlStr = null;
      if (manualRound.deadline_date) {
        dlStr = manualRound.deadline_date;
        if (manualRound.deadline_time) {
          dlStr += `T${manualRound.deadline_time}:00`;
        } else {
          dlStr += `T23:59:59`;
        }
        dlStr = new Date(dlStr).toISOString();
      }
      
      const { error } = await supabase.from('application_rounds').insert({
        user_id: session.user.id,
        application_id: manualRound.application_id,
        round_name: manualRound.round_name,
        deadline: dlStr,
        status: manualRound.status,
        notes: manualRound.notes || null,
      });
      if (error) throw error;
      await recalculateApplicationStatus(manualRound.application_id, supabase);
      setManualRound({ application_id: manualRound.application_id, round_name: '', deadline_date: '', deadline_time: '', status: 'upcoming', notes: '' });
      await fetchData();
    } catch (error) {
      console.error('Error inserting manual round:', error);
    }
  };

  const handleManualPrepSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!manualPrep.prep_type || !manualPrep.date) return;
    try {
      const { error } = await supabase.from('prep_sessions').insert({
        user_id: session.user.id,
        prep_type: manualPrep.prep_type,
        count_or_duration: manualPrep.count_or_duration || null,
        date: manualPrep.date,
        application_id: manualPrep.application_id || null,
        notes: manualPrep.notes || null,
      });
      if (error) throw error;
      setManualPrep({ prep_type: '', count_or_duration: '', application_id: '', date: new Date().toISOString().split('T')[0], notes: '' });
      await fetchData();
    } catch (error) {
      console.error('Error inserting manual prep session:', error);
    }
  };

  const handleToggleRoundStatus = async (roundId: string, currentStatus: string, appId: string) => {
    const newStatus = currentStatus === 'upcoming' ? 'completed' : 'upcoming';
    
    // Optimistic UI update
    setApplications(prev => prev.map(app => ({
      ...app,
      rounds: app.rounds.map(r => r.id === roundId ? { ...r, status: newStatus } : r)
    })));

    try {
      await supabase.from('application_rounds').update({ status: newStatus }).eq('id', roundId);
      await recalculateApplicationStatus(appId, supabase);
      await fetchData();
    } catch (err) {
      console.error('Failed to update status', err);
    }
  };

  const handleDeleteApplication = async (appId: string) => {
    if (!confirm('Are you sure you want to delete this application and all its rounds?')) return;
    setApplications(prev => prev.filter(a => a.id !== appId));
    await supabase.from('job_applications').delete().eq('id', appId);
  };

  const handleDeletePrepSession = async (sessionId: string) => {
    setPrepSessions(prev => prev.filter(p => p.id !== sessionId));
    try {
      await supabase.from('prep_sessions').delete().eq('id', sessionId);
    } catch (err) {
      console.error('Failed to delete prep session', err);
    }
  };

  const handleOpenStatusDropdown = (e: React.MouseEvent<HTMLButtonElement>, appId: string) => {
    if (statusDropdownState?.appId === appId) {
      setStatusDropdownState(null);
      return;
    }
    const rect = e.currentTarget.getBoundingClientRect();
    const dropdownWidth = 160;
    const dropdownHeight = 190;
    
    let left = rect.left;
    if (left + dropdownWidth > window.innerWidth - 12) {
      left = window.innerWidth - dropdownWidth - 12;
    }
    if (left < 12) left = 12;

    let top = rect.bottom + 6;
    if (top + dropdownHeight > window.innerHeight - 12) {
      top = Math.max(12, rect.top - dropdownHeight - 6);
    }

    setStatusDropdownState({
      appId,
      top,
      left,
    });
  };

  const handleManualStatusOverride = async (appId: string, newStatus: string) => {
    setStatusDropdownState(null);
    setApplications(prev => prev.map(app => app.id === appId ? { ...app, status: newStatus, status_manually_set: true } : app));
    try {
      await supabase.from('job_applications').update({ status: newStatus, status_manually_set: true }).eq('id', appId);
      await fetchData();
    } catch (err) {
      console.error('Failed to override status', err);
    }
  };

  const handleResetToAuto = async (appId: string) => {
    setStatusDropdownState(null);
    setApplications(prev => prev.map(app => app.id === appId ? { ...app, status_manually_set: false } : app));
    try {
      await supabase.from('job_applications').update({ status_manually_set: false }).eq('id', appId);
      await recalculateApplicationStatus(appId, supabase);
    } catch (err) {
      console.error('Failed to reset to auto status', err);
    }
  };

  const handleAddNewApplicationRow = async () => {
    if (!session?.user?.id) return;
    try {
      const today = new Date().toISOString().split('T')[0];
      const { data, error } = await supabase
        .from('job_applications')
        .insert({
          user_id: session.user.id,
          company: '',
          role: '',
          status: 'applied',
          status_manually_set: false,
          applied_date: today,
          job_url: null,
          notes: null,
        })
        .select(`
          id,
          company,
          role,
          source,
          applied_date,
          notes,
          job_url,
          status,
          status_manually_set,
          created_at
        `)
        .single();
      if (error) throw error;
      if (data) {
        const newApp: JobApplication = {
          ...data,
          rounds: [],
        };
        setApplications(prev => [newApp, ...prev]);
        handleStartInlineEdit(data.id, 'company', '');
      }
    } catch (err) {
      console.error('Failed to add new application row:', err);
    }
  };

  const handleStartInlineEdit = (appId: string, field: string, initialValue: string | null) => {
    setEditingCell({ appId, field });
    setEditingValue(initialValue || '');
  };

  const handleSaveInlineEdit = async (appId: string, field: string, value: string) => {
    setEditingCell(null);
    const trimmed = value.trim();
    const finalValue = (field === 'company' || field === 'role') ? trimmed : (trimmed === '' ? null : trimmed);

    // Optimistic UI update
    setApplications(prev => prev.map(app => 
      app.id === appId ? { ...app, [field]: finalValue } : app
    ));

    try {
      const { error } = await supabase
        .from('job_applications')
        .update({ [field]: finalValue })
        .eq('id', appId);
      if (error) throw error;
    } catch (err) {
      console.error(`Failed to update ${field}:`, err);
      await fetchData();
    }
  };

  const handleInlineKeyDown = (e: React.KeyboardEvent, appId: string, field: string) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      handleSaveInlineEdit(appId, field, editingValue);
    } else if (e.key === 'Escape') {
      setEditingCell(null);
    }
  };

  const formatExternalUrl = (url: string) => {
    if (!url) return '';
    if (url.startsWith('http://') || url.startsWith('https://')) return url;
    return `https://${url}`;
  };

  // Derive "Due Soon" (upcoming rounds)
  const allUpcomingRounds = applications.flatMap(app => 
    app.rounds
      .filter(r => r.status === 'upcoming' && r.deadline)
      .map(r => ({ ...r, company: app.company, role: app.role }))
  ).sort((a, b) => new Date(a.deadline!).getTime() - new Date(b.deadline!).getTime());

  // Derive prep session grouping
  const getRelativeDateLabel = (dateStr: string) => {
    if (!isMounted) return dateStr;
    const date = new Date(dateStr);
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const dateMidnight = new Date(date);
    dateMidnight.setHours(0, 0, 0, 0);
    
    const diffTime = dateMidnight.getTime() - today.getTime();
    const diffDays = Math.round(diffTime / (1000 * 60 * 60 * 24));
    
    if (diffDays === 0) return 'Today';
    if (diffDays === -1) return 'Yesterday';
    if (diffDays === 1) return 'Tomorrow';
    if (diffDays > 1 && diffDays < 7) return `In ${diffDays} days`;
    if (diffDays < -1 && diffDays > -7) return `${Math.abs(diffDays)} days ago`;
    return date.toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
  };
  
  const getTimeRemainingLabel = (deadlineStr: string) => {
    const deadline = new Date(deadlineStr);
    const now = new Date();
    const diffTime = deadline.getTime() - now.getTime();
    const diffHours = Math.round(diffTime / (1000 * 60 * 60));
    const diffDays = Math.round(diffTime / (1000 * 60 * 60 * 24));

    if (diffHours < 0) return `Overdue by ${Math.abs(diffDays)} days`;
    if (diffHours < 24) return `Due in ${diffHours} hours`;
    if (diffDays === 1) return `Tomorrow at ${deadline.toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}`;
    return `In ${diffDays} days`;
  };

  // Group prep sessions
  const prepGroups = prepSessions.reduce((acc, prep) => {
    const label = getRelativeDateLabel(prep.date);
    if (!acc[label]) acc[label] = [];
    acc[label].push(prep);
    return acc;
  }, {} as Record<string, PrepSession[]>);

  if (authLoading) return null;

  return (
    <div className="flex h-screen bg-background overflow-hidden relative selection:bg-primary-accent/20">
      <AppSidebar 
        activePath="/app/rounds" 
        isMobileMenuOpen={isMobileMenuOpen} 
        onCloseMenu={() => setIsMobileMenuOpen(false)} 
        session={session}
        hideProfile={true}
      />

      {/* Main Content */}
      <main className="flex-1 flex flex-col h-full bg-background relative min-w-0">
        <AppMobileHeader onOpenMenu={() => setIsMobileMenuOpen(true)} />
        <div className="flex-1 overflow-y-auto p-4 md:p-8 custom-scrollbar">
          <div className="max-w-4xl mx-auto flex flex-col gap-8 min-h-full pb-8">
            
            <header className="flex flex-col sm:flex-row sm:items-start justify-between gap-4">
              <div>
                <h1 className="font-serif italic font-bold text-4xl text-primary-text tracking-tight mb-2">Job</h1>
                <p className="text-muted-text text-sm">Track your job applications, interviews, and prep.</p>
              </div>
            </header>

            {/* Add Bar with Toggles */}
            <div className="glass-panel-modal rounded-[24px] p-4 border border-white/10 shadow-[0_8px_32px_rgba(0,0,0,0.3)] relative group">
              <div className="absolute inset-0 rounded-2xl bg-gradient-to-r from-primary-accent/5 via-transparent to-transparent opacity-0 group-focus-within:opacity-100 transition-opacity duration-500 pointer-events-none" />
              
              <div className="relative z-10 flex flex-col gap-4">
                
                {/* Input Mode Toggle */}
                <div className="flex bg-[#1A1714] rounded-lg p-1 w-fit border border-hairline self-start">
                  <button 
                    onClick={() => setInputMode('quick')}
                    className={`px-4 py-1.5 text-sm font-medium rounded-md transition-all ${inputMode === 'quick' ? 'bg-white/10 text-primary-text shadow-sm' : 'text-muted-text hover:text-primary-text'}`}
                  >
                    Quick Add
                  </button>
                  <button 
                    onClick={() => setInputMode('manual')}
                    className={`px-4 py-1.5 text-sm font-medium rounded-md transition-all flex items-center gap-1.5 ${inputMode === 'manual' ? 'bg-white/10 text-primary-text shadow-sm' : 'text-muted-text hover:text-primary-text'}`}
                  >
                    <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                    </svg>
                    Manual
                  </button>
                </div>

                {inputMode === 'quick' ? (
                  <>
                    <form onSubmit={handleAiSubmit} className="flex gap-3">
                      <div className="flex-1 relative">
                        <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-muted-text/50">
                          <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
                          </svg>
                        </div>
                        <input
                          type="text"
                          value={aiInput}
                          onChange={(e) => setAiInput(e.target.value)}
                          disabled={isProcessing}
                          placeholder="Got an OA from Amazon due Friday... or Solved 3 LeetCode mediums today..."
                          className="w-full bg-[#1A1714] text-primary-text border border-hairline rounded-xl pl-10 pr-4 py-3.5 text-[15px] focus:outline-none focus:border-primary-accent/50 focus:ring-1 focus:ring-primary-accent/30 transition-all placeholder:text-muted-text/60 shadow-inner"
                        />
                      </div>
                      <button
                        type="submit"
                        disabled={isProcessing || !aiInput.trim()}
                        className="bg-primary-text text-background font-semibold px-6 py-3.5 rounded-xl hover:bg-white transition-all disabled:opacity-50 disabled:cursor-not-allowed shadow-sm shrink-0 flex items-center gap-2"
                      >
                        {isProcessing ? (
                          <>
                            <div className="w-4 h-4 border-2 border-background/30 border-t-background rounded-full animate-spin"></div>
                            Adding...
                          </>
                        ) : 'Add'}
                      </button>
                    </form>
                    {aiError && (
                      <div className="mt-1 text-red-400 text-sm pl-2 flex items-center gap-2">
                        <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" viewBox="0 0 20 20" fill="currentColor">
                          <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7 4a1 1 0 11-2 0 1 1 0 012 0zm-1-9a1 1 0 00-1 1v4a1 1 0 102 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
                        </svg>
                        {aiError}
                      </div>
                    )}
                  </>
                ) : (
                  <div className="flex flex-col gap-5 pt-2">
                    <div className="flex gap-4 border-b border-hairline">
                      <button onClick={() => setManualType('application')} className={`text-sm font-medium pb-2.5 px-1 -mb-[1px] border-b-2 transition-all ${manualType === 'application' ? 'border-primary-accent text-primary-text' : 'border-transparent text-muted-text hover:text-primary-text'}`}>Application</button>
                      <button onClick={() => setManualType('round')} className={`text-sm font-medium pb-2.5 px-1 -mb-[1px] border-b-2 transition-all ${manualType === 'round' ? 'border-primary-accent text-primary-text' : 'border-transparent text-muted-text hover:text-primary-text'}`}>Round</button>
                      <button onClick={() => setManualType('prep')} className={`text-sm font-medium pb-2.5 px-1 -mb-[1px] border-b-2 transition-all ${manualType === 'prep' ? 'border-primary-accent text-primary-text' : 'border-transparent text-muted-text hover:text-primary-text'}`}>Prep Session</button>
                    </div>

                    {manualType === 'application' && (
                      <form onSubmit={handleManualAppSubmit} className="flex flex-col gap-4">
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                          <input type="text" required placeholder="Company" value={manualApp.company} onChange={e => setManualApp({...manualApp, company: e.target.value})} className="bg-[#1A1714] text-primary-text border border-hairline rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:border-primary-accent/50" />
                          <input type="text" required placeholder="Role" value={manualApp.role} onChange={e => setManualApp({...manualApp, role: e.target.value})} className="bg-[#1A1714] text-primary-text border border-hairline rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:border-primary-accent/50" />
                          <input type="text" placeholder="Source (e.g. Referral, Career Fair)" value={manualApp.source} onChange={e => setManualApp({...manualApp, source: e.target.value})} className="bg-[#1A1714] text-primary-text border border-hairline rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:border-primary-accent/50" />
                          <input type="date" placeholder="Applied Date" value={manualApp.applied_date} onChange={e => setManualApp({...manualApp, applied_date: e.target.value})} className="bg-[#1A1714] text-primary-text border border-hairline rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:border-primary-accent/50 [color-scheme:dark]" />
                          <input type="url" placeholder="Job Listing URL (optional)" value={manualApp.job_url} onChange={e => setManualApp({...manualApp, job_url: e.target.value})} className="md:col-span-2 bg-[#1A1714] text-primary-text border border-hairline rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:border-primary-accent/50" />
                          <textarea placeholder="Notes (optional)" value={manualApp.notes} onChange={e => setManualApp({...manualApp, notes: e.target.value})} rows={2} className="md:col-span-2 bg-[#1A1714] text-primary-text border border-hairline rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:border-primary-accent/50 resize-none" />
                        </div>
                        <button type="submit" disabled={!manualApp.company || !manualApp.role} className="self-end bg-primary-text text-background font-medium px-5 py-2 rounded-lg hover:bg-white transition-all disabled:opacity-50 text-sm">Save Application</button>
                      </form>
                    )}

                    {manualType === 'round' && (
                      <form onSubmit={handleManualRoundSubmit} className="flex flex-col gap-4">
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                          <select required value={manualRound.application_id} onChange={e => setManualRound({...manualRound, application_id: e.target.value})} className="bg-[#1A1714] text-primary-text border border-hairline rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:border-primary-accent/50 appearance-none cursor-pointer">
                            <option value="" disabled>Select Application</option>
                            {applications.length === 0 && <option value="" disabled>No applications exist yet</option>}
                            {applications.map(app => (
                              <option key={app.id} value={app.id}>{app.company} - {app.role}</option>
                            ))}
                          </select>
                          <input type="text" required placeholder="Round Name (e.g. OA, Phone Screen)" value={manualRound.round_name} onChange={e => setManualRound({...manualRound, round_name: e.target.value})} className="bg-[#1A1714] text-primary-text border border-hairline rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:border-primary-accent/50" />
                          <input type="date" value={manualRound.deadline_date} onChange={e => setManualRound({...manualRound, deadline_date: e.target.value})} className="bg-[#1A1714] text-primary-text border border-hairline rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:border-primary-accent/50 [color-scheme:dark]" />
                          <input type="time" value={manualRound.deadline_time} onChange={e => setManualRound({...manualRound, deadline_time: e.target.value})} className="bg-[#1A1714] text-primary-text border border-hairline rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:border-primary-accent/50 [color-scheme:dark]" />
                          <select required value={manualRound.status} onChange={e => setManualRound({...manualRound, status: e.target.value})} className="bg-[#1A1714] text-primary-text border border-hairline rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:border-primary-accent/50 appearance-none cursor-pointer">
                            <option value="upcoming">Upcoming</option>
                            <option value="completed">Completed</option>
                            <option value="passed">Passed</option>
                            <option value="rejected">Rejected</option>
                          </select>
                          <textarea placeholder="Notes (optional)" value={manualRound.notes} onChange={e => setManualRound({...manualRound, notes: e.target.value})} rows={1} className="md:col-span-2 bg-[#1A1714] text-primary-text border border-hairline rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:border-primary-accent/50 resize-none" />
                        </div>
                        <button type="submit" disabled={!manualRound.application_id || !manualRound.round_name} className="self-end bg-primary-text text-background font-medium px-5 py-2 rounded-lg hover:bg-white transition-all disabled:opacity-50 text-sm">Save Round</button>
                      </form>
                    )}

                    {manualType === 'prep' && (
                      <form onSubmit={handleManualPrepSubmit} className="flex flex-col gap-4">
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                          <input type="text" required placeholder="Prep Type (e.g. LeetCode, Mock Interview)" value={manualPrep.prep_type} onChange={e => setManualPrep({...manualPrep, prep_type: e.target.value})} className="bg-[#1A1714] text-primary-text border border-hairline rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:border-primary-accent/50" />
                          <input type="text" placeholder="Duration / Count (e.g. 45 mins, 3 problems)" value={manualPrep.count_or_duration} onChange={e => setManualPrep({...manualPrep, count_or_duration: e.target.value})} className="bg-[#1A1714] text-primary-text border border-hairline rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:border-primary-accent/50" />
                          <select value={manualPrep.application_id} onChange={e => setManualPrep({...manualPrep, application_id: e.target.value})} className="bg-[#1A1714] text-primary-text border border-hairline rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:border-primary-accent/50 appearance-none cursor-pointer">
                            <option value="">No linked application (General Prep)</option>
                            {applications.map(app => (
                              <option key={app.id} value={app.id}>{app.company} - {app.role}</option>
                            ))}
                          </select>
                          <input type="date" required value={manualPrep.date} onChange={e => setManualPrep({...manualPrep, date: e.target.value})} className="bg-[#1A1714] text-primary-text border border-hairline rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:border-primary-accent/50 [color-scheme:dark]" />
                          <textarea placeholder="Notes (optional)" value={manualPrep.notes} onChange={e => setManualPrep({...manualPrep, notes: e.target.value})} rows={2} className="md:col-span-2 bg-[#1A1714] text-primary-text border border-hairline rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:border-primary-accent/50 resize-none" />
                        </div>
                        <button type="submit" disabled={!manualPrep.prep_type || !manualPrep.date} className="self-end bg-primary-text text-background font-medium px-5 py-2 rounded-lg hover:bg-white transition-all disabled:opacity-50 text-sm">Save Prep Session</button>
                      </form>
                    )}
                  </div>
                )}
              </div>
            </div>

            {loading ? (
              <div className="flex items-center justify-center p-12">
                <div className="w-8 h-8 border-4 border-primary-accent border-t-transparent rounded-full animate-spin"></div>
              </div>
            ) : (
              <div className="flex flex-col gap-8">
                
                {/* Top 2-Column Grid: Left Col (Due Soon + Applications Cards) & Right Col (Prep Reps) */}
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                  
                  {/* Left Col: Due Soon & Applications Cards */}
                  <div className="flex flex-col gap-6">
                    
                    {/* 1. Due Soon Section */}
                    {allUpcomingRounds.length > 0 && (
                      <div className="flex flex-col gap-3">
                        <h2 className="text-xs font-medium text-red-400 uppercase tracking-wider pl-1 flex items-center gap-2">
                          <span className="w-2 h-2 rounded-full bg-red-400 animate-pulse" />
                          Due Soon
                        </h2>
                        <div className="glass-panel-modal rounded-[24px] border border-white/10 shadow-[0_8px_32px_rgba(0,0,0,0.3)] p-4 flex flex-col gap-4">
                          {allUpcomingRounds.map((round) => (
                            <div key={round.id} className="flex flex-col gap-1 border-l-2 border-red-500/50 pl-3 py-1">
                              <div className="flex justify-between items-start gap-4">
                                <span className="font-medium text-primary-text leading-tight">{round.company} <span className="text-muted-text font-normal ml-1">· {round.round_name}</span></span>
                                {round.deadline && (
                                  <span className="text-[11px] font-medium px-2 py-1 bg-red-500/10 text-red-400 rounded-md whitespace-nowrap">
                                    {isMounted ? getTimeRemainingLabel(round.deadline) : ''}
                                  </span>
                                )}
                              </div>
                              <span className="text-sm text-muted-text">{round.role}</span>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}

                    {/* 2. Applications Section (Card View) */}
                    <div className="flex flex-col gap-3">
                      <h2 className="text-xs font-medium text-muted-text uppercase tracking-wider pl-1">Applications</h2>
                      {applications.length === 0 ? (
                        <div className="glass-panel-modal rounded-[24px] border border-white/10 shadow-[0_8px_32px_rgba(0,0,0,0.3)] p-5 text-center text-muted-text">
                          <p className="text-sm">No applications yet.</p>
                          <p className="text-xs text-muted-text/70 mt-1">Add one in Job Tracker below or use Quick Add above.</p>
                        </div>
                      ) : (
                        <div className="flex flex-col gap-4">
                          {applications.map((app) => (
                            <div key={app.id} className="glass-panel-modal rounded-[24px] border border-white/10 shadow-[0_8px_32px_rgba(0,0,0,0.3)] overflow-hidden group">
                              <div className="p-4 border-b border-white/5 flex justify-between items-start bg-white/[0.02]">
                                <div>
                                  <div className="font-bold text-lg text-primary-text flex items-center gap-2">
                                    <span>{app.company}</span>
                                    {app.job_url && (
                                      <a
                                        href={formatExternalUrl(app.job_url)}
                                        target="_blank"
                                        rel="noopener noreferrer"
                                        className="text-muted-text hover:text-primary-accent transition-colors"
                                        title="Open job listing"
                                      >
                                        <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
                                        </svg>
                                      </a>
                                    )}
                                  </div>
                                  <div className="text-sm text-muted-text">{app.role}</div>
                                </div>
                              <div className="flex items-center gap-3">
                                <button
                                  onClick={(e) => handleOpenStatusDropdown(e, app.id)}
                                  className={`px-2.5 py-1 text-[11px] font-bold uppercase tracking-wider rounded-md border flex items-center gap-1.5 transition-colors ${
                                    app.status === 'accepted' ? 'bg-[#8A9A5B] text-white border-transparent hover:brightness-110' :
                                    app.status === 'rejected' ? 'bg-red-500 text-white border-transparent hover:brightness-110' :
                                    app.status === 'in_progress' ? 'bg-amber-500 text-[#1A1714] border-transparent hover:brightness-110' :
                                    'bg-muted-text text-white border-transparent hover:brightness-110'
                                  }`}
                                >
                                  {app.status === 'in_progress' ? 'In Progress' : app.status}
                                </button>
                                <button 
                                  onClick={() => handleDeleteApplication(app.id)}
                                  className="text-muted-text hover:text-red-400 opacity-0 group-hover:opacity-100 transition-opacity focus:outline-none"
                                  title="Delete Application"
                                >
                                  <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                                  </svg>
                                </button>
                              </div>
                            </div>
                            <div className="p-4 flex flex-col gap-3">
                              {app.rounds.length === 0 ? (
                                <p className="text-sm text-muted-text italic">No rounds tracked yet.</p>
                              ) : (
                                app.rounds.map((round, idx) => (
                                  <div key={round.id} className="flex items-start gap-3 relative">
                                    {idx !== app.rounds.length - 1 && (
                                      <div className="absolute left-2.5 top-6 bottom-[-16px] w-[1px] bg-white/10" />
                                    )}
                                    <button 
                                      onClick={() => handleToggleRoundStatus(round.id, round.status, app.id)}
                                      className={`w-5 h-5 mt-0.5 rounded-full border flex items-center justify-center flex-shrink-0 transition-colors z-10 ${
                                        round.status === 'completed' || round.status === 'passed' 
                                          ? 'bg-primary-accent border-primary-accent text-background' 
                                          : 'bg-background border-white/20 hover:border-primary-accent'
                                      }`}
                                    >
                                      {(round.status === 'completed' || round.status === 'passed') && (
                                        <svg xmlns="http://www.w3.org/2000/svg" className="h-3 w-3" viewBox="0 0 20 20" fill="currentColor">
                                          <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                                        </svg>
                                      )}
                                    </button>
                                    <div className="flex flex-col flex-1">
                                      <div className={`text-[15px] font-medium ${round.status === 'completed' || round.status === 'passed' ? 'text-muted-text line-through opacity-70' : 'text-primary-text'}`}>
                                        {round.round_name}
                                      </div>
                                      {round.deadline && (
                                        <div className={`text-xs mt-0.5 ${round.status === 'upcoming' ? 'text-primary-accent/80' : 'text-muted-text'}`}>
                                          {isMounted ? new Date(round.deadline).toLocaleString(undefined, { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' }) : ''}
                                        </div>
                                      )}
                                      {round.notes && (
                                        <div className="text-xs text-muted-text mt-1 bg-white/5 p-2 rounded-md italic">
                                          {round.notes}
                                        </div>
                                      )}
                                    </div>
                                  </div>
                                ))
                              )}
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                </div>

                  {/* Right Col: 4. Prep Reps */}
                  <div className="flex flex-col gap-6">
                    <div className="flex flex-col gap-3">
                      <h2 className="text-xs font-medium text-muted-text uppercase tracking-wider pl-1">Prep Reps</h2>
                      <div className="glass-panel-modal rounded-[24px] border border-white/10 shadow-[0_8px_32px_rgba(0,0,0,0.3)] p-5 flex flex-col gap-5">
                        {prepSessions.length === 0 ? (
                          <p className="text-sm text-muted-text italic">No prep sessions logged yet.</p>
                        ) : (
                          Object.entries(prepGroups).map(([dateLabel, sessions]) => (
                            <div key={dateLabel} className="flex flex-col gap-2">
                              <div className="text-xs font-medium text-muted-text uppercase tracking-wider">{dateLabel}</div>
                              <div className="flex flex-col gap-2">
                                {sessions.map(session => (
                                  <div key={session.id} className="flex justify-between items-center bg-white/5 px-3 py-2.5 rounded-lg border border-white/5 group relative">
                                    <div className="flex flex-col">
                                      <span className="text-sm font-medium text-primary-text">{session.prep_type}</span>
                                      {session.company_reference && (
                                        <span className="text-[11px] text-muted-text">for {session.company_reference}</span>
                                      )}
                                    </div>
                                    <div className="flex items-center gap-3">
                                      {session.count_or_duration && (
                                        <span className="text-sm font-medium text-primary-accent/90 bg-primary-accent/10 px-2 py-0.5 rounded">
                                          {session.count_or_duration}
                                        </span>
                                      )}
                                      <button 
                                        onClick={() => handleDeletePrepSession(session.id)}
                                        className="text-muted-text hover:text-red-400 opacity-0 group-hover:opacity-100 transition-opacity focus:outline-none"
                                        title="Delete Prep Session"
                                      >
                                        <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                                        </svg>
                                      </button>
                                    </div>
                                  </div>
                                ))}
                              </div>
                            </div>
                          ))
                        )}
                      </div>
                    </div>
                  </div>

                </div>

                {/* 3. Job Tracker Section (Spreadsheet-style Table View) */}
                <div className="flex flex-col gap-3">
                  <div className="flex justify-between items-center pl-1">
                    <h2 className="text-xs font-medium text-muted-text uppercase tracking-wider">Job Tracker</h2>
                    <button
                      onClick={handleAddNewApplicationRow}
                      className="text-xs font-medium text-primary-accent hover:text-white bg-primary-accent/10 hover:bg-primary-accent/20 border border-primary-accent/30 rounded-lg px-2.5 py-1 flex items-center gap-1.5 transition-all shadow-sm"
                      title="Add Application"
                    >
                      <svg xmlns="http://www.w3.org/2000/svg" className="h-3.5 w-3.5" viewBox="0 0 20 20" fill="currentColor">
                        <path fillRule="evenodd" d="M10 3a1 1 0 011 1v5h5a1 1 0 110 2h-5v5a1 1 0 11-2 0v-5H4a1 1 0 110-2h5V4a1 1 0 011-1z" clipRule="evenodd" />
                      </svg>
                      <span>Add Application</span>
                    </button>
                  </div>
                  {/* Desktop View: Spreadsheet-style Table */}
                  <div className="hidden md:block glass-panel-modal rounded-[24px] border border-white/10 shadow-[0_8px_32px_rgba(0,0,0,0.3)] overflow-hidden">
                    <div className="overflow-x-auto">
                      <table className="w-full text-left text-sm border-collapse min-w-[620px]">
                        <thead>
                          <tr className="border-b border-white/10 bg-white/[0.03] text-[11px] font-medium text-muted-text uppercase tracking-wider select-none">
                            <th className="py-3 px-3.5 font-medium">Company</th>
                            <th className="py-3 px-3.5 font-medium">Role</th>
                            <th className="py-3 px-3.5 font-medium">Status</th>
                            <th className="py-3 px-3.5 font-medium">Link to Listing</th>
                            <th className="py-3 px-3.5 font-medium">Notes</th>
                            <th className="py-3 px-3.5 font-medium">Date Applied</th>
                            <th className="py-3 px-2 w-8 text-right"></th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-white/5 text-xs">
                          {applications.length === 0 ? (
                            <tr>
                              <td colSpan={7} className="py-8 text-center text-muted-text">
                                <div className="flex flex-col items-center justify-center gap-2">
                                  <p className="text-sm font-medium text-primary-text/80">No applications yet</p>
                                  <button
                                    onClick={handleAddNewApplicationRow}
                                    className="text-xs text-primary-accent hover:underline flex items-center gap-1 mt-0.5"
                                  >
                                    <svg xmlns="http://www.w3.org/2000/svg" className="h-3.5 w-3.5" viewBox="0 0 20 20" fill="currentColor">
                                      <path fillRule="evenodd" d="M10 3a1 1 0 011 1v5h5a1 1 0 110 2h-5v5a1 1 0 11-2 0v-5H4a1 1 0 110-2h5V4a1 1 0 011-1z" clipRule="evenodd" />
                                    </svg>
                                    Click + to add your first job application
                                  </button>
                                </div>
                              </td>
                            </tr>
                          ) : (
                            applications.map((app) => (
                              <tr key={app.id} className="group hover:bg-white/[0.02] transition-colors">
                                
                                {/* 1. Company */}
                                <td className="py-2.5 px-3.5 align-middle">
                                  {editingCell?.appId === app.id && editingCell?.field === 'company' ? (
                                    <input
                                      type="text"
                                      value={editingValue}
                                      onChange={(e) => setEditingValue(e.target.value)}
                                      onBlur={() => handleSaveInlineEdit(app.id, 'company', editingValue)}
                                      onKeyDown={(e) => handleInlineKeyDown(e, app.id, 'company')}
                                      className="bg-[#1A1714] text-primary-text border border-primary-accent/50 rounded px-2 py-1 text-xs w-full focus:outline-none"
                                      autoFocus
                                      placeholder="Add company..."
                                    />
                                  ) : (
                                    <div
                                      onClick={() => handleStartInlineEdit(app.id, 'company', app.company)}
                                      className="text-primary-text font-medium cursor-pointer hover:bg-white/5 rounded px-1.5 -mx-1.5 py-0.5 transition-colors truncate"
                                      title={app.company || 'Click to edit company'}
                                    >
                                      {app.company ? (
                                        <span>{app.company}</span>
                                      ) : (
                                        <span className="text-muted-text/40 italic font-normal">Add company...</span>
                                      )}
                                    </div>
                                  )}
                                </td>

                                {/* 2. Role */}
                                <td className="py-2.5 px-3.5 align-middle">
                                  {editingCell?.appId === app.id && editingCell?.field === 'role' ? (
                                    <input
                                      type="text"
                                      value={editingValue}
                                      onChange={(e) => setEditingValue(e.target.value)}
                                      onBlur={() => handleSaveInlineEdit(app.id, 'role', editingValue)}
                                      onKeyDown={(e) => handleInlineKeyDown(e, app.id, 'role')}
                                      className="bg-[#1A1714] text-primary-text border border-primary-accent/50 rounded px-2 py-1 text-xs w-full focus:outline-none"
                                      autoFocus
                                      placeholder="Add role..."
                                    />
                                  ) : (
                                    <div
                                      onClick={() => handleStartInlineEdit(app.id, 'role', app.role)}
                                      className="text-muted-text cursor-pointer hover:bg-white/5 rounded px-1.5 -mx-1.5 py-0.5 transition-colors truncate"
                                      title={app.role || 'Click to edit role'}
                                    >
                                      {app.role ? (
                                        <span>{app.role}</span>
                                      ) : (
                                        <span className="text-muted-text/40 italic">Add role...</span>
                                      )}
                                    </div>
                                  )}
                                </td>

                                {/* 3. Status */}
                                <td className="py-2.5 px-3.5 align-middle">
                                  <button
                                    onClick={(e) => handleOpenStatusDropdown(e, app.id)}
                                    className={`px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider rounded border flex items-center gap-1 transition-colors ${
                                      app.status === 'accepted' ? 'bg-[#8A9A5B] text-white border-transparent hover:brightness-110' :
                                      app.status === 'rejected' ? 'bg-red-500 text-white border-transparent hover:brightness-110' :
                                      app.status === 'in_progress' ? 'bg-amber-500 text-[#1A1714] border-transparent hover:brightness-110' :
                                      'bg-muted-text text-white border-transparent hover:brightness-110'
                                    }`}
                                  >
                                    <span>
                                      {app.status === 'accepted' ? 'ACCEPTED' :
                                       app.status === 'rejected' ? 'REJECTED' :
                                       app.status === 'in_progress' ? 'IN PROGRESS' :
                                       'APPLIED'}
                                    </span>
                                    <svg className="w-2.5 h-2.5 opacity-60 ml-0.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="m6 9 6 6 6-6"/></svg>
                                  </button>
                                </td>

                                {/* 4. Link to Listing */}
                                <td className="py-2.5 px-3.5 align-middle max-w-[200px]">
                                  {editingCell?.appId === app.id && editingCell?.field === 'job_url' ? (
                                    <input
                                      type="text"
                                      value={editingValue}
                                      onChange={(e) => setEditingValue(e.target.value)}
                                      onBlur={() => handleSaveInlineEdit(app.id, 'job_url', editingValue)}
                                      onKeyDown={(e) => handleInlineKeyDown(e, app.id, 'job_url')}
                                      className="bg-[#1A1714] text-primary-text border border-primary-accent/50 rounded px-2 py-1 text-xs w-full focus:outline-none"
                                      autoFocus
                                      placeholder="https://..."
                                    />
                                  ) : (
                                    <div className="flex items-center gap-1.5 group/url">
                                      {app.job_url ? (
                                        <>
                                          <a
                                            href={formatExternalUrl(app.job_url)}
                                            target="_blank"
                                            rel="noopener noreferrer"
                                            className="text-primary-accent hover:underline flex items-center gap-1 truncate max-w-[140px]"
                                            title={app.job_url}
                                          >
                                            <span className="truncate">{app.job_url.replace(/^https?:\/\/(www\.)?/, '')}</span>
                                            <svg xmlns="http://www.w3.org/2000/svg" className="h-3 w-3 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
                                            </svg>
                                          </a>
                                          <button
                                            onClick={() => handleStartInlineEdit(app.id, 'job_url', app.job_url)}
                                            className="text-muted-text/40 hover:text-muted-text opacity-0 group-hover/url:opacity-100 transition-opacity p-0.5"
                                            title="Edit link"
                                          >
                                            <svg xmlns="http://www.w3.org/2000/svg" className="h-3 w-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" />
                                            </svg>
                                          </button>
                                        </>
                                      ) : (
                                        <span
                                          onClick={() => handleStartInlineEdit(app.id, 'job_url', '')}
                                          className="text-muted-text/40 italic cursor-pointer hover:text-muted-text transition-colors"
                                          title="Click to add link"
                                        >
                                          Add link...
                                        </span>
                                      )}
                                    </div>
                                  )}
                                </td>

                                {/* 5. Notes */}
                                <td className="py-2.5 px-3.5 align-middle max-w-[200px]">
                                  {editingCell?.appId === app.id && editingCell?.field === 'notes' ? (
                                    <input
                                      type="text"
                                      value={editingValue}
                                      onChange={(e) => setEditingValue(e.target.value)}
                                      onBlur={() => handleSaveInlineEdit(app.id, 'notes', editingValue)}
                                      onKeyDown={(e) => handleInlineKeyDown(e, app.id, 'notes')}
                                      className="bg-[#1A1714] text-primary-text border border-primary-accent/50 rounded px-2 py-1 text-xs w-full focus:outline-none"
                                      autoFocus
                                      placeholder="Add notes..."
                                    />
                                  ) : (
                                    <div
                                      onClick={() => handleStartInlineEdit(app.id, 'notes', app.notes)}
                                      className="cursor-pointer hover:bg-white/5 rounded px-1.5 -mx-1.5 py-0.5 transition-colors truncate"
                                      title={app.notes || 'Click to add notes'}
                                    >
                                      {app.notes ? (
                                        <span className="text-muted-text">{app.notes}</span>
                                      ) : (
                                        <span className="text-muted-text/40 italic">Add notes...</span>
                                      )}
                                    </div>
                                  )}
                                </td>

                                {/* 6. Date Applied */}
                                <td className="py-2.5 px-3.5 align-middle whitespace-nowrap">
                                  {editingCell?.appId === app.id && editingCell?.field === 'applied_date' ? (
                                    <input
                                      type="date"
                                      value={editingValue}
                                      onChange={(e) => setEditingValue(e.target.value)}
                                      onBlur={() => handleSaveInlineEdit(app.id, 'applied_date', editingValue)}
                                      onKeyDown={(e) => handleInlineKeyDown(e, app.id, 'applied_date')}
                                      className="bg-[#1A1714] text-primary-text border border-primary-accent/50 rounded px-2 py-1 text-xs focus:outline-none [color-scheme:dark]"
                                      autoFocus
                                    />
                                  ) : (
                                    <div
                                      onClick={() => handleStartInlineEdit(app.id, 'applied_date', app.applied_date)}
                                      className="cursor-pointer hover:bg-white/5 rounded px-1.5 -mx-1.5 py-0.5 transition-colors"
                                      title="Click to change date applied"
                                    >
                                      {app.applied_date ? (
                                        <span className="text-muted-text">{app.applied_date}</span>
                                      ) : (
                                        <span className="text-muted-text/40 italic">Add date...</span>
                                      )}
                                    </div>
                                  )}
                                </td>

                                {/* Row Delete Action */}
                                <td className="py-2.5 px-2 align-middle text-right">
                                  <button
                                    onClick={() => handleDeleteApplication(app.id)}
                                    className="text-muted-text/40 hover:text-red-400 opacity-0 group-hover:opacity-100 transition-opacity p-1 focus:outline-none"
                                    title="Delete Application"
                                  >
                                    <svg xmlns="http://www.w3.org/2000/svg" className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                                    </svg>
                                  </button>
                                </td>

                              </tr>
                            ))
                          )}
                        </tbody>
                      </table>
                    </div>
                  </div>

                  {/* Mobile View: Stacked Cards */}
                  <div className="block md:hidden flex flex-col gap-3">
                    {applications.length === 0 ? (
                      <div className="glass-panel-modal rounded-[24px] border border-white/10 shadow-[0_8px_32px_rgba(0,0,0,0.3)] p-6 text-center text-muted-text">
                        <p className="text-sm font-medium text-primary-text/80">No applications yet</p>
                        <button
                          onClick={handleAddNewApplicationRow}
                          className="text-xs text-primary-accent hover:underline flex items-center justify-center gap-1.5 mt-2 mx-auto"
                        >
                          <svg xmlns="http://www.w3.org/2000/svg" className="h-3.5 w-3.5" viewBox="0 0 20 20" fill="currentColor">
                            <path fillRule="evenodd" d="M10 3a1 1 0 011 1v5h5a1 1 0 110 2h-5v5a1 1 0 11-2 0v-5H4a1 1 0 110-2h5V4a1 1 0 011-1z" clipRule="evenodd" />
                          </svg>
                          <span>Click + to add your first job application</span>
                        </button>
                      </div>
                    ) : (
                      <>
                        <div className="flex flex-col gap-3.5">
                          {applications.map((app) => (
                            <div key={app.id} className="glass-panel-modal rounded-[24px] border border-white/10 shadow-[0_8px_32px_rgba(0,0,0,0.3)] overflow-hidden">
                              {/* Card Header: Company, Role, and Trash Delete button */}
                              <div className="p-4 border-b border-white/5 bg-white/[0.02] flex justify-between items-start gap-2">
                                <div className="flex-1 min-w-0 flex flex-col gap-0.5">
                                  {/* Company Name */}
                                  {editingCell?.appId === app.id && editingCell?.field === 'company' ? (
                                    <input
                                      type="text"
                                      value={editingValue}
                                      onChange={(e) => setEditingValue(e.target.value)}
                                      onBlur={() => handleSaveInlineEdit(app.id, 'company', editingValue)}
                                      onKeyDown={(e) => handleInlineKeyDown(e, app.id, 'company')}
                                      className="bg-[#1A1714] text-primary-text font-bold text-base border border-primary-accent/50 rounded px-2.5 py-1 w-full focus:outline-none"
                                      autoFocus
                                      placeholder="Add company..."
                                    />
                                  ) : (
                                    <div
                                      onClick={() => handleStartInlineEdit(app.id, 'company', app.company)}
                                      className="font-bold text-base text-primary-text cursor-pointer hover:bg-white/5 rounded px-1.5 -mx-1.5 py-0.5 transition-colors truncate"
                                      title="Tap to edit company"
                                    >
                                      {app.company ? (
                                        <span>{app.company}</span>
                                      ) : (
                                        <span className="text-muted-text/40 italic font-normal">Add company...</span>
                                      )}
                                    </div>
                                  )}

                                  {/* Role */}
                                  {editingCell?.appId === app.id && editingCell?.field === 'role' ? (
                                    <input
                                      type="text"
                                      value={editingValue}
                                      onChange={(e) => setEditingValue(e.target.value)}
                                      onBlur={() => handleSaveInlineEdit(app.id, 'role', editingValue)}
                                      onKeyDown={(e) => handleInlineKeyDown(e, app.id, 'role')}
                                      className="bg-[#1A1714] text-muted-text text-sm border border-primary-accent/50 rounded px-2.5 py-1 w-full focus:outline-none mt-1"
                                      autoFocus
                                      placeholder="Add role..."
                                    />
                                  ) : (
                                    <div
                                      onClick={() => handleStartInlineEdit(app.id, 'role', app.role)}
                                      className="text-sm text-muted-text cursor-pointer hover:bg-white/5 rounded px-1.5 -mx-1.5 py-0.5 transition-colors truncate"
                                      title="Tap to edit role"
                                    >
                                      {app.role ? (
                                        <span>{app.role}</span>
                                      ) : (
                                        <span className="text-muted-text/40 italic">Add role...</span>
                                      )}
                                    </div>
                                  )}
                                </div>

                                {/* Delete Button */}
                                <button
                                  onClick={() => handleDeleteApplication(app.id)}
                                  className="text-muted-text/40 hover:text-red-400 p-1.5 focus:outline-none rounded transition-colors"
                                  title="Delete Application"
                                >
                                  <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                                  </svg>
                                </button>
                              </div>

                              {/* Card Body: Labeled Fields */}
                              <div className="p-3.5 flex flex-col divide-y divide-white/5 text-xs">
                                
                                {/* Field: STATUS */}
                                <div className="py-2.5 flex items-center justify-between gap-3">
                                  <span className="text-[10px] font-semibold text-muted-text/70 uppercase tracking-wider w-16 shrink-0">STATUS</span>
                                  <div className="flex-1 flex justify-end">
                                    <button
                                      onClick={(e) => handleOpenStatusDropdown(e, app.id)}
                                      className={`px-3 py-1 text-[11px] font-bold uppercase tracking-wider rounded border flex items-center gap-1.5 transition-colors ${
                                        app.status === 'accepted' ? 'bg-[#8A9A5B] text-white border-transparent hover:brightness-110' :
                                        app.status === 'rejected' ? 'bg-red-500 text-white border-transparent hover:brightness-110' :
                                        app.status === 'in_progress' ? 'bg-amber-500 text-[#1A1714] border-transparent hover:brightness-110' :
                                        'bg-muted-text text-white border-transparent hover:brightness-110'
                                      }`}
                                    >
                                      <span>
                                        {app.status === 'accepted' ? 'ACCEPTED' :
                                         app.status === 'rejected' ? 'REJECTED' :
                                         app.status === 'in_progress' ? 'IN PROGRESS' :
                                         'APPLIED'}
                                      </span>
                                      <svg className="w-3 h-3 opacity-60 ml-0.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="m6 9 6 6 6-6"/></svg>
                                    </button>
                                  </div>
                                </div>

                                {/* Field: LINK */}
                                <div className="py-2.5 flex items-center justify-between gap-3">
                                  <span className="text-[10px] font-semibold text-muted-text/70 uppercase tracking-wider w-16 shrink-0">LINK</span>
                                  <div className="flex-1 min-w-0">
                                    {editingCell?.appId === app.id && editingCell?.field === 'job_url' ? (
                                      <input
                                        type="text"
                                        value={editingValue}
                                        onChange={(e) => setEditingValue(e.target.value)}
                                        onBlur={() => handleSaveInlineEdit(app.id, 'job_url', editingValue)}
                                        onKeyDown={(e) => handleInlineKeyDown(e, app.id, 'job_url')}
                                        className="bg-[#1A1714] text-primary-text border border-primary-accent/50 rounded px-2.5 py-1 text-xs w-full focus:outline-none"
                                        autoFocus
                                        placeholder="https://..."
                                      />
                                    ) : (
                                      <div className="flex items-center gap-1.5">
                                        {app.job_url ? (
                                          <>
                                            <a
                                              href={formatExternalUrl(app.job_url)}
                                              target="_blank"
                                              rel="noopener noreferrer"
                                              className="text-primary-accent hover:underline flex items-center gap-1 truncate max-w-[200px]"
                                              title={app.job_url}
                                            >
                                              <span className="truncate">{app.job_url.replace(/^https?:\/\/(www\.)?/, '')}</span>
                                              <svg xmlns="http://www.w3.org/2000/svg" className="h-3 w-3 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
                                              </svg>
                                            </a>
                                            <button
                                              onClick={() => handleStartInlineEdit(app.id, 'job_url', app.job_url)}
                                              className="text-muted-text/50 hover:text-muted-text p-1"
                                              title="Edit link"
                                            >
                                              <svg xmlns="http://www.w3.org/2000/svg" className="h-3 w-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" />
                                              </svg>
                                            </button>
                                          </>
                                        ) : (
                                          <span
                                            onClick={() => handleStartInlineEdit(app.id, 'job_url', '')}
                                            className="text-muted-text/40 italic cursor-pointer hover:text-muted-text transition-colors py-0.5"
                                            title="Tap to add link"
                                          >
                                            Add link...
                                          </span>
                                        )}
                                      </div>
                                    )}
                                  </div>
                                </div>

                                {/* Field: NOTES */}
                                <div className="py-2.5 flex items-start justify-between gap-3">
                                  <span className="text-[10px] font-semibold text-muted-text/70 uppercase tracking-wider w-16 shrink-0 pt-0.5">NOTES</span>
                                  <div className="flex-1 min-w-0">
                                    {editingCell?.appId === app.id && editingCell?.field === 'notes' ? (
                                      <input
                                        type="text"
                                        value={editingValue}
                                        onChange={(e) => setEditingValue(e.target.value)}
                                        onBlur={() => handleSaveInlineEdit(app.id, 'notes', editingValue)}
                                        onKeyDown={(e) => handleInlineKeyDown(e, app.id, 'notes')}
                                        className="bg-[#1A1714] text-primary-text border border-primary-accent/50 rounded px-2.5 py-1 text-xs w-full focus:outline-none"
                                        autoFocus
                                        placeholder="Add notes..."
                                      />
                                    ) : (
                                      <div
                                        onClick={() => handleStartInlineEdit(app.id, 'notes', app.notes)}
                                        className="cursor-pointer hover:bg-white/5 rounded px-1.5 -mx-1.5 py-0.5 transition-colors truncate"
                                        title={app.notes || 'Tap to add notes'}
                                      >
                                        {app.notes ? (
                                          <span className="text-muted-text">{app.notes}</span>
                                        ) : (
                                          <span className="text-muted-text/40 italic">Add notes...</span>
                                        )}
                                      </div>
                                    )}
                                  </div>
                                </div>

                                {/* Field: DATE */}
                                <div className="py-2.5 flex items-center justify-between gap-3">
                                  <span className="text-[10px] font-semibold text-muted-text/70 uppercase tracking-wider w-16 shrink-0">DATE</span>
                                  <div className="flex-1 min-w-0">
                                    {editingCell?.appId === app.id && editingCell?.field === 'applied_date' ? (
                                      <input
                                        type="date"
                                        value={editingValue}
                                        onChange={(e) => setEditingValue(e.target.value)}
                                        onBlur={() => handleSaveInlineEdit(app.id, 'applied_date', editingValue)}
                                        onKeyDown={(e) => handleInlineKeyDown(e, app.id, 'applied_date')}
                                        className="bg-[#1A1714] text-primary-text border border-primary-accent/50 rounded px-2.5 py-1 text-xs focus:outline-none [color-scheme:dark]"
                                        autoFocus
                                      />
                                    ) : (
                                      <div
                                        onClick={() => handleStartInlineEdit(app.id, 'applied_date', app.applied_date)}
                                        className="cursor-pointer hover:bg-white/5 rounded px-1.5 -mx-1.5 py-0.5 transition-colors"
                                        title="Tap to change date applied"
                                      >
                                        {app.applied_date ? (
                                          <span className="text-muted-text">{app.applied_date}</span>
                                        ) : (
                                          <span className="text-muted-text/40 italic">Add date...</span>
                                        )}
                                      </div>
                                    )}
                                  </div>
                                </div>

                              </div>
                            </div>
                          ))}
                        </div>

                        {/* Mobile Add Application button below cards */}
                        <button
                          onClick={handleAddNewApplicationRow}
                          className="w-full py-2.5 px-4 bg-primary-accent/10 hover:bg-primary-accent/20 border border-primary-accent/30 text-primary-accent font-medium rounded-xl text-xs flex items-center justify-center gap-2 transition-all shadow-sm active:scale-[0.99]"
                        >
                          <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" viewBox="0 0 20 20" fill="currentColor">
                            <path fillRule="evenodd" d="M10 3a1 1 0 011 1v5h5a1 1 0 110 2h-5v5a1 1 0 11-2 0v-5H4a1 1 0 110-2h5V4a1 1 0 011-1z" clipRule="evenodd" />
                          </svg>
                          <span>Add Application</span>
                        </button>
                      </>
                    )}
                  </div>
                </div>
                
              </div>
            )}
            
          </div>
        </div>

        {/* Fixed Floating Status Dropdown Menu (immune to row / table clipping) */}
        {statusDropdownState && (() => {
          const app = applications.find(a => a.id === statusDropdownState.appId);
          if (!app) return null;
          return (
            <>
              <div 
                className="fixed inset-0 z-50 bg-transparent" 
                onClick={() => setStatusDropdownState(null)} 
              />
              <div 
                className="fixed z-50 w-40 bg-[#1A1714] border border-white/10 rounded-xl shadow-2xl overflow-hidden text-xs divide-y divide-white/5 animate-in fade-in zoom-in-95 duration-100"
                style={{ top: `${statusDropdownState.top}px`, left: `${statusDropdownState.left}px` }}
              >
                <div className="p-1">
                  <button 
                    onClick={() => handleManualStatusOverride(app.id, 'applied')} 
                    className={`w-full text-left px-3 py-2 rounded-lg transition-colors flex items-center gap-2 ${app.status === 'applied' ? 'bg-white/10 text-primary-text font-medium' : 'text-muted-text hover:text-primary-text hover:bg-white/5'}`}
                  >
                    <span className="w-2 h-2 rounded-full bg-muted-text/50" />
                    Applied
                  </button>
                  <button 
                    onClick={() => handleManualStatusOverride(app.id, 'in_progress')} 
                    className={`w-full text-left px-3 py-2 rounded-lg transition-colors flex items-center gap-2 ${app.status === 'in_progress' ? 'bg-amber-500/10 text-amber-500 font-medium' : 'text-amber-500/70 hover:text-amber-500 hover:bg-white/5'}`}
                  >
                    <span className="w-2 h-2 rounded-full bg-amber-500" />
                    In Progress
                  </button>
                  <button 
                    onClick={() => handleManualStatusOverride(app.id, 'accepted')} 
                    className={`w-full text-left px-3 py-2 rounded-lg transition-colors flex items-center gap-2 ${app.status === 'accepted' ? 'bg-[#8A9A5B]/10 text-[#8A9A5B] font-medium' : 'text-[#8A9A5B]/70 hover:text-[#8A9A5B] hover:bg-white/5'}`}
                  >
                    <span className="w-2 h-2 rounded-full bg-[#8A9A5B]" />
                    Accepted
                  </button>
                  <button 
                    onClick={() => handleManualStatusOverride(app.id, 'rejected')} 
                    className={`w-full text-left px-3 py-2 rounded-lg transition-colors flex items-center gap-2 ${app.status === 'rejected' ? 'bg-red-500/10 text-red-400 font-medium' : 'text-red-400/70 hover:text-red-400 hover:bg-white/5'}`}
                  >
                    <span className="w-2 h-2 rounded-full bg-red-400" />
                    Rejected
                  </button>
                </div>
                <div className="p-1">
                  <button 
                    onClick={() => handleResetToAuto(app.id)} 
                    disabled={!app.status_manually_set}
                    className="w-full text-left px-3 py-1.5 text-[11px] text-muted-text hover:text-primary-text hover:bg-white/5 rounded-lg transition-colors disabled:opacity-30 disabled:cursor-not-allowed flex justify-between items-center"
                  >
                    <span>Reset to auto</span>
                    <svg className="w-3 h-3" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M3 12a9 9 0 1 0 9-9 9.75 9.75 0 0 0-6.74 2.74L3 8" /><path d="M3 3v5h5" /></svg>
                  </button>
                </div>
              </div>
            </>
          );
        })()}

      </main>
    </div>
  );
}
