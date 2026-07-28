'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { supabase } from '@/lib/supabase';
import AppSidebar from '@/components/AppSidebar';
import AppMobileHeader from '@/components/AppMobileHeader';

interface JobApplication {
  id: string;
  company: string;
  role: string;
  source: string | null;
  applied_date: string | null;
  notes: string | null;
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

  // Manual Form States
  const [manualApp, setManualApp] = useState({ company: '', role: '', source: '', applied_date: '', notes: '' });
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
      
      for (const item of results) {
        if (item.type === 'round') {
          // 1. Find or create the company application
          const companyName = item.company || 'Unknown Company';
          const roleName = item.role || 'Software Engineer';
          
          let appId = null;
          const existingApp = applications.find(a => a.company.toLowerCase() === companyName.toLowerCase());
          
          if (existingApp) {
            appId = existingApp.id;
          } else {
            const { data: newApp, error: newAppErr } = await supabase
              .from('job_applications')
              .insert({
                user_id: session.user.id,
                company: companyName,
                role: roleName,
              })
              .select()
              .single();
              
            if (newAppErr) throw newAppErr;
            appId = newApp.id;
          }

          let parsedDeadline = null;
          if (item.deadline) {
            let dl = item.deadline;
            // If the AI just returned YYYY-MM-DD, assume end of day
            if (dl.length === 10) {
              dl = `${dl}T23:59:59`;
            }
            // Strip any Z to force local time parsing
            dl = dl.replace('Z', '');
            
            // new Date("YYYY-MM-DDTHH:mm:ss") without a Z parses as local time
            parsedDeadline = new Date(dl).toISOString();
          }

          // 2. Add the round
          const { error: roundErr } = await supabase
            .from('application_rounds')
            .insert({
              user_id: session.user.id,
              application_id: appId,
              round_name: item.round_name || 'Interview',
              deadline: parsedDeadline,
              notes: item.notes || null,
              status: 'upcoming'
            });
            
          if (roundErr) throw roundErr;
          
        } else if (item.type === 'prep') {
          // Add prep session
          // Try to link to an application if company_reference is provided
          let appId = null;
          if (item.company_reference) {
            const existingApp = applications.find(a => a.company.toLowerCase() === item.company_reference.toLowerCase());
            if (existingApp) appId = existingApp.id;
          }
          
          const { error: prepErr } = await supabase
            .from('prep_sessions')
            .insert({
              user_id: session.user.id,
              prep_type: item.prep_type || 'Prep Session',
              count_or_duration: item.count_or_duration || null,
              date: new Date().toISOString().split('T')[0],
              application_id: appId
            });
            
          if (prepErr) throw prepErr;
        }
      }

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
      });
      if (error) throw error;
      setManualApp({ company: '', role: '', source: '', applied_date: '', notes: '' });
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

  const handleToggleRoundStatus = async (roundId: string, currentStatus: string) => {
    const newStatus = currentStatus === 'upcoming' ? 'completed' : 'upcoming';
    
    // Optimistic UI update
    setApplications(prev => prev.map(app => ({
      ...app,
      rounds: app.rounds.map(r => r.id === roundId ? { ...r, status: newStatus } : r)
    })));

    try {
      await supabase.from('application_rounds').update({ status: newStatus }).eq('id', roundId);
    } catch (err) {
      console.error('Failed to update status', err);
    }
  };

  const handleDeleteApplication = async (appId: string) => {
    if (!confirm('Are you sure you want to delete this application and all its rounds?')) return;
    setApplications(prev => prev.filter(a => a.id !== appId));
    await supabase.from('job_applications').delete().eq('id', appId);
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
                <h1 className="font-serif italic font-bold text-4xl text-primary-text tracking-tight mb-2">Prep</h1>
                <p className="text-muted-text text-sm">Track your job applications, interviews, and prep.</p>
              </div>
            </header>

            {/* Add Bar with Toggles */}
            <div className="bg-card/50 backdrop-blur-md rounded-2xl p-4 border border-hairline shadow-sm relative group">
              <div className="absolute inset-0 rounded-2xl bg-gradient-to-r from-primary-accent/5 via-transparent to-transparent opacity-0 group-focus-within:opacity-100 transition-opacity duration-500 pointer-events-none" />
              
              <div className="relative z-10 flex flex-col gap-4">
                
                {/* Input Mode Toggle */}
                <div className="flex bg-[#1A1714] rounded-lg p-1 w-fit border border-hairline self-start">
                  <button 
                    onClick={() => setInputMode('quick')}
                    className={`px-4 py-1.5 text-sm font-medium rounded-md transition-all ${inputMode === 'quick' ? 'bg-card text-primary-text shadow-sm' : 'text-muted-text hover:text-primary-text'}`}
                  >
                    Quick Add
                  </button>
                  <button 
                    onClick={() => setInputMode('manual')}
                    className={`px-4 py-1.5 text-sm font-medium rounded-md transition-all flex items-center gap-1.5 ${inputMode === 'manual' ? 'bg-card text-primary-text shadow-sm' : 'text-muted-text hover:text-primary-text'}`}
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
            ) : applications.length === 0 && prepSessions.length === 0 ? (
              <div className="flex-1 flex flex-col items-center justify-center text-center opacity-60">
                <svg xmlns="http://www.w3.org/2000/svg" className="h-16 w-16 text-muted-text mb-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1} d="M19 20H5a2 2 0 01-2-2V6a2 2 0 012-2h10a2 2 0 012 2v1m2 13a2 2 0 01-2-2V7m2 13a2 2 0 002-2V9.5a2.5 2.5 0 00-2.5-2.5H15M9 11l3 3L22 4" />
                </svg>
                <p className="text-primary-text text-lg mb-2">No applications yet</p>
                <p className="text-muted-text text-sm max-w-sm">Use the input above to quickly track job application rounds and prep sessions using AI.</p>
              </div>
            ) : (
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                
                {/* Left Col: Primary Layout (Due Soon + Applications) */}
                <div className="flex flex-col gap-6">
                  
                  {/* Due Soon Section */}
                  {allUpcomingRounds.length > 0 && (
                    <div className="flex flex-col gap-3">
                      <h2 className="text-xs font-medium text-red-400 uppercase tracking-wider pl-1 flex items-center gap-2">
                        <span className="w-2 h-2 rounded-full bg-red-400 animate-pulse" />
                        Due Soon
                      </h2>
                      <div className="bg-card rounded-xl border border-white/10 shadow-[0_2px_8px_rgba(0,0,0,0.25)] p-4 flex flex-col gap-4">
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

                  {/* Applications List */}
                  <div className="flex flex-col gap-3">
                    <h2 className="text-xs font-medium text-muted-text uppercase tracking-wider pl-1">Applications</h2>
                    <div className="flex flex-col gap-4">
                      {applications.map((app) => (
                        <div key={app.id} className="bg-card rounded-xl border border-white/10 shadow-[0_2px_8px_rgba(0,0,0,0.25)] overflow-hidden group">
                          <div className="p-4 border-b border-white/5 flex justify-between items-start bg-white/[0.02]">
                            <div>
                              <div className="font-bold text-lg text-primary-text">{app.company}</div>
                              <div className="text-sm text-muted-text">{app.role}</div>
                            </div>
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
                                    onClick={() => handleToggleRoundStatus(round.id, round.status)}
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
                  </div>
                </div>

                {/* Right Col: Prep Reps */}
                <div className="flex flex-col gap-6">
                  
                  {/* Prep Reps Section */}
                  <div className="flex flex-col gap-3">
                    <h2 className="text-xs font-medium text-muted-text uppercase tracking-wider pl-1">Prep Reps</h2>
                    <div className="bg-card rounded-xl border border-white/10 shadow-[0_2px_8px_rgba(0,0,0,0.25)] p-5 flex flex-col gap-5">
                      {prepSessions.length === 0 ? (
                        <p className="text-sm text-muted-text italic">No prep sessions logged yet.</p>
                      ) : (
                        Object.entries(prepGroups).map(([dateLabel, sessions]) => (
                          <div key={dateLabel} className="flex flex-col gap-2">
                            <div className="text-xs font-medium text-muted-text uppercase tracking-wider">{dateLabel}</div>
                            <div className="flex flex-col gap-2">
                              {sessions.map(session => (
                                <div key={session.id} className="flex justify-between items-center bg-white/5 px-3 py-2.5 rounded-lg border border-white/5">
                                  <div className="flex flex-col">
                                    <span className="text-sm font-medium text-primary-text">{session.prep_type}</span>
                                    {session.company_reference && (
                                      <span className="text-[11px] text-muted-text">for {session.company_reference}</span>
                                    )}
                                  </div>
                                  {session.count_or_duration && (
                                    <span className="text-sm font-medium text-primary-accent/90 bg-primary-accent/10 px-2 py-0.5 rounded">
                                      {session.count_or_duration}
                                    </span>
                                  )}
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
            )}
            
          </div>
        </div>
      </main>
    </div>
  );
}
