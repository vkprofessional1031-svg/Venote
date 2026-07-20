'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { supabase } from '@/lib/supabase';
import AppSidebar from '@/components/AppSidebar';
import AppMobileHeader from '@/components/AppMobileHeader';
import { useToast } from '@/components/ToastProvider';
import { Entry } from '@/components/EntriesList';

interface TaskItem {
  text: string;
  done: boolean;
  dueDate?: string | null;
  completedAt?: string | null;
}

interface TodayTask {
  parentEntryId: string;
  parentEntryTitle: string;
  resultIndex: number;
  taskIndex: number;
  item: TaskItem;
  isOverdue: boolean;
}

export default function TodayView() {
  const [session, setSession] = useState<any>(null);
  const [authLoading, setAuthLoading] = useState(true);
  const [entriesLoading, setEntriesLoading] = useState(true);
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [tasks, setTasks] = useState<TodayTask[]>([]);
  const router = useRouter();
  const { showToast } = useToast();

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
      if (!session) router.push('/login');
      setAuthLoading(false);
    });

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      setSession(session);
      if (!session) {
        router.push('/login');
      }
    });

    return () => subscription.unsubscribe();
  }, [router]);

  useEffect(() => {
    if (authLoading || !session?.user?.id) return;

    const fetchTasks = async () => {
      setEntriesLoading(true);
      try {
        const { data, error } = await supabase
          .from('entries')
          .select('*')
          .eq('user_id', session.user.id)
          .eq('is_archived', false)
          .order('created_at', { ascending: false });

        if (error) throw error;

        // Ensure stable local date representation for "today"
        const now = new Date();
        const todayStr = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;

        const extractedTasks: TodayTask[] = [];

        (data as Entry[]).forEach(entry => {
          if (!entry.results || !entry.results.length) return;
          const entryTitle = entry.results[0]?.title || 'Untitled';
          
          entry.results.forEach((res: any, rIdx: number) => {
            if (res.type === 'tasks' && Array.isArray(res.items)) {
              res.items.forEach((item: TaskItem, tIdx: number) => {
                if (item.dueDate && !item.done) {
                  // Both dates are YYYY-MM-DD strings so we can do string comparison
                  if (item.dueDate <= todayStr) {
                    extractedTasks.push({
                      parentEntryId: entry.id,
                      parentEntryTitle: entryTitle,
                      resultIndex: rIdx,
                      taskIndex: tIdx,
                      item,
                      isOverdue: item.dueDate < todayStr
                    });
                  }
                }
              });
            }
          });
        });

        // Sort: Overdue first (oldest first), then Today
        extractedTasks.sort((a, b) => {
          if (a.isOverdue && !b.isOverdue) return -1;
          if (!a.isOverdue && b.isOverdue) return 1;
          if (a.item.dueDate && b.item.dueDate) {
            return a.item.dueDate.localeCompare(b.item.dueDate);
          }
          return 0;
        });

        setTasks(extractedTasks);
      } catch (err) {
        console.error('Failed to fetch entries:', err);
        showToast('Failed to load tasks', 'error');
      } finally {
        setEntriesLoading(false);
      }
    };

    fetchTasks();
  }, [session?.user?.id, authLoading]);

  const handleToggleTask = async (task: TodayTask) => {
    // Optimistic UI update
    setTasks(current => current.filter(t => 
      !(t.parentEntryId === task.parentEntryId && t.resultIndex === task.resultIndex && t.taskIndex === task.taskIndex)
    ));

    try {
      // 1. Fetch latest entry payload directly from DB to prevent race conditions or overwriting other data
      const { data, error } = await supabase
        .from('entries')
        .select('results')
        .eq('id', task.parentEntryId)
        .single();
        
      if (error) throw error;
      
      const newResults = [...data.results];
      if (newResults[task.resultIndex] && newResults[task.resultIndex].items) {
        const item = newResults[task.resultIndex].items[task.taskIndex];
        item.done = true;
        item.completedAt = new Date().toISOString();
      }
      
      // 2. Update DB
      const { error: updateError } = await supabase
        .from('entries')
        .update({ 
          results: newResults,
          updated_at: new Date().toISOString()
        })
        .eq('id', task.parentEntryId);
        
      if (updateError) throw updateError;
      
    } catch (err) {
      console.error('Failed to update task:', err);
      showToast('Failed to complete task', 'error');
      // On error, a full re-fetch would be safest to sync state, but for MVP just show error
    }
  };

  if (authLoading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="w-8 h-8 border-4 border-primary-accent border-t-transparent rounded-full animate-spin"></div>
      </div>
    );
  }

  const overdueTasks = tasks.filter(t => t.isOverdue);
  const todayTasks = tasks.filter(t => !t.isOverdue);

  const displayName = session?.user?.user_metadata?.name || session?.user?.user_metadata?.full_name || session?.user?.email || '';
  const initial = displayName ? displayName.charAt(0).toUpperCase() : '?';

  return (
    <div className="flex h-[100dvh] md:h-screen bg-background overflow-hidden font-sans text-primary-text selection:bg-primary-accent/30 selection:text-primary-text">
      
      <AppSidebar 
        activePath="/app/today" 
        isMobileMenuOpen={isMobileMenuOpen} 
        onCloseMenu={() => setIsMobileMenuOpen(false)} 
        session={session} 
      />

      {/* Main Content */}
      <main className="flex-1 overflow-y-auto flex flex-col w-full min-w-0">
        
        {/* Mobile Header */}
        <AppMobileHeader onOpenMenu={() => setIsMobileMenuOpen(true)} />

        <div className="flex-1 flex flex-col items-center p-4 py-8 md:px-8 md:py-16">
          <div className="w-full max-w-2xl flex flex-col items-start space-y-12">
            
            <div className="w-full mb-4">
              <h1 className="font-serif italic font-bold text-4xl md:text-[40px] tracking-tight leading-[1.1] text-primary-text mb-3">
                Today
              </h1>
              <p className="text-muted-text">
                Tasks due today or overdue across all your entries.
              </p>
            </div>

            {entriesLoading ? (
              <div className="flex justify-center w-full py-12">
                <svg className="animate-spin h-6 w-6 text-muted-text" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                </svg>
              </div>
            ) : tasks.length === 0 ? (
              <div className="flex flex-col items-center justify-center w-full py-16 text-center text-muted-text">
                <svg xmlns="http://www.w3.org/2000/svg" className="h-12 w-12 mb-4 opacity-50" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
                <p className="text-lg">Nothing due today</p>
              </div>
            ) : (
              <div className="w-full space-y-10">
                {overdueTasks.length > 0 && (
                  <div className="w-full space-y-4">
                    <h2 className="font-mono text-xs font-bold tracking-widest text-red-400 uppercase flex items-center gap-2">
                      <span className="w-2 h-2 rounded-full bg-red-400 shrink-0"></span>
                      Overdue
                    </h2>
                    <div className="bg-card rounded-2xl border border-hairline overflow-hidden">
                      {overdueTasks.map((t, i) => (
                        <div key={`${t.parentEntryId}-${t.resultIndex}-${t.taskIndex}`} className={`p-4 flex items-start gap-3 hover:bg-background/50 transition-colors ${i !== overdueTasks.length - 1 ? 'border-b border-hairline' : ''}`}>
                          <button
                            type="button"
                            onClick={() => handleToggleTask(t)}
                            className="mt-0.5 shrink-0 w-5 h-5 rounded-full border-2 border-muted-text/40 hover:border-primary-accent transition-colors flex items-center justify-center"
                          >
                          </button>
                          <div className="flex-1 min-w-0">
                            <p className="text-primary-text leading-snug">{t.item.text || 'Untitled task'}</p>
                            <div className="flex items-center gap-2 mt-2">
                              <span className="text-xs text-red-400 font-medium">
                                {new Date(t.item.dueDate! + 'T12:00:00').toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                              </span>
                              <span className="text-xs text-muted-text/40">•</span>
                              <Link 
                                href={`/app?entry=${t.parentEntryId}`}
                                className="text-xs text-muted-text hover:text-primary-accent hover:underline truncate"
                              >
                                {t.parentEntryTitle}
                              </Link>
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {todayTasks.length > 0 && (
                  <div className="w-full space-y-4">
                    <h2 className="font-mono text-xs font-bold tracking-widest text-primary-text uppercase flex items-center gap-2">
                      <span className="w-2 h-2 rounded-full bg-primary-accent shrink-0"></span>
                      Due Today
                    </h2>
                    <div className="bg-card rounded-2xl border border-hairline overflow-hidden">
                      {todayTasks.map((t, i) => (
                        <div key={`${t.parentEntryId}-${t.resultIndex}-${t.taskIndex}`} className={`p-4 flex items-start gap-3 hover:bg-background/50 transition-colors ${i !== todayTasks.length - 1 ? 'border-b border-hairline' : ''}`}>
                          <button
                            type="button"
                            onClick={() => handleToggleTask(t)}
                            className="mt-0.5 shrink-0 w-5 h-5 rounded-full border-2 border-muted-text/40 hover:border-primary-accent transition-colors flex items-center justify-center"
                          >
                          </button>
                          <div className="flex-1 min-w-0">
                            <p className="text-primary-text leading-snug">{t.item.text || 'Untitled task'}</p>
                            <div className="flex items-center gap-2 mt-2">
                              <span className="text-xs text-primary-accent font-medium">Today</span>
                              <span className="text-xs text-muted-text/40">•</span>
                              <Link 
                                href={`/app?entry=${t.parentEntryId}`}
                                className="text-xs text-muted-text hover:text-primary-accent hover:underline truncate"
                              >
                                {t.parentEntryTitle}
                              </Link>
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      </main>
    </div>
  );
}
