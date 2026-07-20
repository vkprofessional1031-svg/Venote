'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { supabase } from '@/lib/supabase';
import AppSidebar from '@/components/AppSidebar';
import AppMobileHeader from '@/components/AppMobileHeader';
import { Entry } from '@/components/EntriesList';

interface TaskItem {
  text: string;
  done: boolean;
  dueDate?: string | null;
  completedAt?: string | null;
}

export default function ThisWeekView() {
  const [session, setSession] = useState<any>(null);
  const [authLoading, setAuthLoading] = useState(true);
  const [entriesLoading, setEntriesLoading] = useState(true);
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  
  const [totalTasks, setTotalTasks] = useState(0);
  const [completedTasks, setCompletedTasks] = useState(0);
  const [bestDay, setBestDay] = useState<string>('-');
  const [strokeOffset, setStrokeOffset] = useState(565.48); // Initial state for animation

  const router = useRouter();

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
      if (!session) router.push('/login');
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
          .select('created_at, results')
          .eq('user_id', session.user.id)
          .eq('is_archived', false);

        if (error) throw error;

        // Calculate Monday to Sunday bounds
        const now = new Date();
        const currentDay = now.getDay(); // 0 = Sunday, 1 = Monday
        const diffToMonday = currentDay === 0 ? -6 : 1 - currentDay;

        const monday = new Date(now);
        monday.setDate(now.getDate() + diffToMonday);
        monday.setHours(0, 0, 0, 0);

        const sunday = new Date(monday);
        sunday.setDate(monday.getDate() + 6);
        sunday.setHours(23, 59, 59, 999);

        const mondayStr = monday.toISOString();
        const sundayStr = sunday.toISOString();
        const mondayDateStr = mondayStr.split('T')[0];
        const sundayDateStr = sundayStr.split('T')[0];

        let totalCount = 0;
        let completedCount = 0;
        const completionsByDay: Record<string, number> = { 
          'Mon': 0, 'Tue': 0, 'Wed': 0, 'Thu': 0, 'Fri': 0, 'Sat': 0, 'Sun': 0 
        };
        const dayNames = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

        (data as any[]).forEach(entry => {
          if (!entry.results) return;
          
          entry.results.forEach((res: any) => {
            if (res.type === 'tasks' && Array.isArray(res.items)) {
              res.items.forEach((item: TaskItem) => {
                const isCreatedThisWeek = entry.created_at >= mondayStr && entry.created_at <= sundayStr;
                const isDueThisWeek = item.dueDate && item.dueDate >= mondayDateStr && item.dueDate <= sundayDateStr;
                const isCompletedThisWeek = item.done && item.completedAt && item.completedAt >= mondayStr && item.completedAt <= sundayStr;
                
                if (isCreatedThisWeek || isDueThisWeek || isCompletedThisWeek) {
                  totalCount++;
                }

                if (isCompletedThisWeek && item.completedAt) {
                  completedCount++;
                  const completedDate = new Date(item.completedAt);
                  const dayName = dayNames[completedDate.getDay()];
                  completionsByDay[dayName]++;
                }
              });
            }
          });
        });

        setTotalTasks(totalCount);
        setCompletedTasks(completedCount);
        
        let topDay = '-';
        let maxCount = 0;
        for (const [day, count] of Object.entries(completionsByDay)) {
          if (count > maxCount) {
            maxCount = count;
            topDay = day;
          }
        }
        setBestDay(topDay);

        // Animate stroke after load
        setTimeout(() => {
          const circumference = 2 * Math.PI * 90;
          const percentage = totalCount > 0 ? (completedCount / totalCount) : 0;
          const offset = circumference - percentage * circumference;
          setStrokeOffset(offset);
        }, 100);

      } catch (err) {
        console.error('Failed to fetch activity:', err);
      } finally {
        setEntriesLoading(false);
      }
    };

    fetchTasks();
  }, [session?.user?.id, authLoading]);

  if (authLoading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="w-8 h-8 border-4 border-primary-accent border-t-transparent rounded-full animate-spin"></div>
      </div>
    );
  }

  const displayName = session?.user?.user_metadata?.name || session?.user?.user_metadata?.full_name || session?.user?.email || '';
  const initial = displayName ? displayName.charAt(0).toUpperCase() : '?';
  
  const percentage = totalTasks > 0 ? Math.round((completedTasks / totalTasks) * 100) : 0;
  const circumference = 2 * Math.PI * 90;

  return (
    <div className="flex h-[100dvh] md:h-screen bg-background overflow-hidden font-sans text-primary-text selection:bg-primary-accent/30 selection:text-primary-text">
      
      <AppSidebar 
        activePath="/app/this-week" 
        isMobileMenuOpen={isMobileMenuOpen} 
        onCloseMenu={() => setIsMobileMenuOpen(false)} 
        session={session} 
      />

      {/* Main Content */}
      <main className="flex-1 overflow-y-auto flex flex-col w-full min-w-0">
        
        {/* Mobile Header */}
        <AppMobileHeader onOpenMenu={() => setIsMobileMenuOpen(true)} />

        <div className="flex-1 flex flex-col items-center p-4 py-8 md:px-8 md:py-16">
          <div className="w-full max-w-4xl flex flex-col items-start space-y-12">
            
            <div className="w-full mb-4">
              <h1 className="font-serif italic font-bold text-4xl md:text-[40px] tracking-tight leading-[1.1] text-primary-text mb-3">
                Progress
              </h1>
              <p className="text-muted-text">
                Your progress for the current week (Monday - Sunday).
              </p>
            </div>

            {entriesLoading ? (
              <div className="flex justify-center w-full py-12">
                <svg className="animate-spin h-6 w-6 text-muted-text" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                </svg>
              </div>
            ) : (
              <div className="w-full flex flex-col items-center justify-center space-y-12 py-10">
                
                {/* Circular Progress Indicator */}
                <div className="relative w-64 h-64 flex items-center justify-center">
                  <svg className="w-full h-full transform -rotate-90 drop-shadow-2xl" viewBox="0 0 200 200">
                    <circle 
                      cx="100" 
                      cy="100" 
                      r="90" 
                      fill="transparent" 
                      stroke="#1A1714" 
                      strokeWidth="12"
                      strokeLinecap="round"
                    />
                    <circle 
                      cx="100" 
                      cy="100" 
                      r="90" 
                      fill="transparent" 
                      stroke="#FF5C38" 
                      strokeWidth="12"
                      strokeLinecap="round"
                      strokeDasharray={circumference}
                      strokeDashoffset={strokeOffset}
                      className="transition-all duration-1000 ease-out"
                    />
                  </svg>
                  <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
                    <span className="text-5xl font-serif italic font-bold tracking-tight">{percentage}%</span>
                    <span className="text-sm text-muted-text font-medium mt-1 tracking-widest uppercase">{completedTasks} / {totalTasks}</span>
                  </div>
                </div>

                {/* Stat Lines */}
                <div className="flex items-center gap-10">
                  <div className="flex flex-col items-center p-6 bg-card border border-hairline rounded-[24px] min-w-[160px] shadow-sm">
                    <span className="text-sm font-mono tracking-widest text-muted-text uppercase mb-2">Completed</span>
                    <span className="text-3xl font-serif italic font-bold text-primary-text">{completedTasks}</span>
                  </div>
                  <div className="flex flex-col items-center p-6 bg-card border border-hairline rounded-[24px] min-w-[160px] shadow-sm">
                    <span className="text-sm font-mono tracking-widest text-muted-text uppercase mb-2">Best Day</span>
                    <span className="text-3xl font-serif italic font-bold text-primary-accent">{bestDay}</span>
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
