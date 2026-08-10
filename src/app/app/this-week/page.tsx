'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { supabase } from '@/lib/supabase';
import AppSidebar from '@/components/AppSidebar';
import AppMobileHeader from '@/components/AppMobileHeader';

// Types
interface TaskItem {
  text: string;
  done: boolean;
  dueDate?: string | null;
  completedAt?: string | null;
}
interface NeedsAttentionItem {
  id: string;
  title: string;
  subtitle: string;
  href: string;
  type: 'overdue_task' | 'budget' | 'urgent_round' | 'unscheduled';
  color?: string;
}

export default function ThisWeekView() {
  const [session, setSession] = useState<any>(null);
  const [authLoading, setAuthLoading] = useState(true);
  const [dataLoading, setDataLoading] = useState(true);
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  
  // Progress Ring Data
  const [totalTasks, setTotalTasks] = useState(0);
  const [completedTasks, setCompletedTasks] = useState(0);
  const [strokeOffset, setStrokeOffset] = useState(565.48); // Initial state for animation
  
  // New Dashboard Data
  const [netSpend, setNetSpend] = useState(0);
  const [activeJobApps, setActiveJobApps] = useState(0);
  const [upcomingRoundsCount, setUpcomingRoundsCount] = useState(0);
  const [unscheduledCount, setUnscheduledCount] = useState(0);
  const [needsAttention, setNeedsAttention] = useState<NeedsAttentionItem[]>([]);
  const [activityByDay, setActivityByDay] = useState<Record<string, number>>({ 
    'Mon': 0, 'Tue': 0, 'Wed': 0, 'Thu': 0, 'Fri': 0, 'Sat': 0, 'Sun': 0 
  });

  const router = useRouter();

  // Auth Effect
  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
      if (!session) router.push('/login');
      setAuthLoading(false);
    });
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setSession(session);
      if (!session) router.push('/login');
    });
    return () => subscription.unsubscribe();
  }, [router]);

  // Data Fetch Effect
  useEffect(() => {
    if (authLoading || !session?.user?.id) return;

    const fetchDashboardData = async () => {
      setDataLoading(true);
      try {
        const userId = session.user.id;
        const now = new Date();
        
        // Monday - Sunday logic
        const currentDay = now.getDay();
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
        const todayDateStr = now.toISOString().split('T')[0];
        
        // 3 days from now
        const threeDaysFromNow = new Date(now);
        threeDaysFromNow.setDate(now.getDate() + 3);
        const threeDaysStr = threeDaysFromNow.toISOString();

        // Month start for budgets
        const currentMonthStart = new Date(now.getFullYear(), now.getMonth(), 1).toISOString().split('T')[0];

        // Fetch everything in parallel
        const [
          { data: entries },
          { data: expenses },
          { data: incomes },
          { data: jobApps },
          { data: rounds },
          { data: blocks },
          { data: budgets }
        ] = await Promise.all([
          supabase.from('entries').select('id, created_at, results, is_archived').eq('user_id', userId).eq('is_archived', false),
          supabase.from('expenses').select('amount, date, category').eq('user_id', userId).gte('date', mondayDateStr).lte('date', sundayDateStr),
          supabase.from('incomes').select('amount, date').eq('user_id', userId).gte('date', mondayDateStr).lte('date', sundayDateStr),
          supabase.from('job_applications').select('id, status').eq('user_id', userId).neq('status', 'Rejected'),
          supabase.from('application_rounds').select('id, application_id, deadline, status, round_name, job_applications(company)').eq('user_id', userId).neq('status', 'completed').neq('status', 'passed').neq('status', 'rejected'),
          supabase.from('schedule_blocks').select('id, linked_round_id, linked_entry_id').eq('user_id', userId),
          supabase.from('category_budgets').select('category, monthly_limit').eq('user_id', userId)
        ]);

        // -- Process Organize (Entries) --
        let totalCount = 0;
        let completedCount = 0;
        const compsByDay = { 'Mon': 0, 'Tue': 0, 'Wed': 0, 'Thu': 0, 'Fri': 0, 'Sat': 0, 'Sun': 0 };
        const dayNames = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
        
        const overdue: NeedsAttentionItem[] = [];
        let unscheduledItemsCounter = 0;

        (entries || []).forEach((entry: any) => {
          if (!entry.results) return;
          let isUnscheduled = false;

          entry.results.forEach((res: any) => {
            if (res.type === 'tasks' && Array.isArray(res.items)) {
              isUnscheduled = true; // Any task entry is potentially unscheduled
              res.items.forEach((item: TaskItem) => {
                const isCreatedThisWeek = entry.created_at >= mondayStr && entry.created_at <= sundayStr;
                const isDueThisWeek = item.dueDate && item.dueDate >= mondayDateStr && item.dueDate <= sundayDateStr;
                const isCompletedThisWeek = item.done && item.completedAt && item.completedAt >= mondayStr && item.completedAt <= sundayStr;
                
                if (isCreatedThisWeek || isDueThisWeek || isCompletedThisWeek) totalCount++;
                if (isCompletedThisWeek && item.completedAt) {
                  completedCount++;
                  const completedDate = new Date(item.completedAt);
                  compsByDay[dayNames[completedDate.getDay()] as keyof typeof compsByDay]++;
                }
                
                // Overdue tasks
                if (item.dueDate && item.dueDate < todayDateStr && !item.done) {
                  overdue.push({
                    id: `overdue-${entry.id}-${item.text}`,
                    title: `Overdue: ${item.text}`,
                    subtitle: `Due ${new Date(item.dueDate).toLocaleDateString()}`,
                    href: `/app/organize`,
                    type: 'overdue_task'
                  });
                }
              });
            } else if (res.type === 'note') {
              isUnscheduled = true;
            }
          });
          
          if (isUnscheduled) {
            const hasBlock = (blocks || []).some((b: any) => b.linked_entry_id === entry.id);
            if (!hasBlock) unscheduledItemsCounter++;
          }
        });

        // -- Process Wallet (Net Spend & Budgets) --
        const totalExpenses = (expenses || []).reduce((acc, curr) => acc + Number(curr.amount), 0);
        const totalIncomes = (incomes || []).reduce((acc, curr) => acc + Number(curr.amount), 0);
        const calcNetSpend = totalIncomes - totalExpenses;
        
        // For budgets, we need monthly expenses, not just weekly
        const { data: monthlyExpenses } = await supabase.from('expenses').select('amount, category').eq('user_id', userId).gte('date', currentMonthStart);
        const budgetAlertsList: NeedsAttentionItem[] = [];
        
        if (budgets && monthlyExpenses) {
          const spendByCategory: Record<string, number> = {};
          monthlyExpenses.forEach((e: any) => {
            spendByCategory[e.category] = (spendByCategory[e.category] || 0) + Number(e.amount);
          });
          
          budgets.forEach((b: any) => {
            const spent = spendByCategory[b.category] || 0;
            const ratio = spent / b.monthly_limit;
            if (ratio >= 0.9) {
              let color = 'text-amber-500';
              if (ratio >= 1.0) color = 'text-red-500';
              else if (ratio >= 0.9) color = 'text-orange-500';
              
              budgetAlertsList.push({
                id: `budget-${b.category}`,
                title: `${b.category} Budget`,
                subtitle: `${(ratio * 100).toFixed(0)}% used ($${spent.toFixed(0)} / $${b.monthly_limit})`,
                href: '/app/expenses',
                type: 'budget',
                color
              });
            }
          });
        }

        // -- Process Jobs (Active apps, upcoming rounds, unscheduled rounds) --
        const activeApps = (jobApps || []).length;
        let upcomingRounds = 0;
        const urgentRoundsList: NeedsAttentionItem[] = [];
        
        (rounds || []).forEach((r: any) => {
          if (r.deadline) {
            if (r.deadline >= mondayStr && r.deadline <= sundayStr) {
              upcomingRounds++;
            }
            if (r.deadline <= threeDaysStr && r.deadline >= todayDateStr) {
              urgentRoundsList.push({
                id: `urgent-round-${r.id}`,
                title: `Upcoming: ${r.job_applications?.company || 'Company'} - ${r.round_name}`,
                subtitle: `In ${Math.ceil((new Date(r.deadline).getTime() - now.getTime()) / (1000 * 3600 * 24))} days`,
                href: '/app/prep',
                type: 'urgent_round'
              });
            }
          }
          
          const hasBlock = (blocks || []).some((b: any) => b.linked_round_id === r.id);
          if (!hasBlock) unscheduledItemsCounter++;
        });

        // -- Set State --
        setTotalTasks(totalCount);
        setCompletedTasks(completedCount);
        setActivityByDay(compsByDay);
        
        setNetSpend(calcNetSpend);
        setActiveJobApps(activeApps);
        setUpcomingRoundsCount(upcomingRounds);
        setUnscheduledCount(unscheduledItemsCounter);
        
        const attentionItems = [
          ...budgetAlertsList,
          ...overdue,
          ...urgentRoundsList,
        ];
        
        if (unscheduledItemsCounter > 0) {
          attentionItems.push({
            id: 'unscheduled-items-alert',
            title: `${unscheduledItemsCounter} Unscheduled Items`,
            subtitle: 'Place them on your calendar',
            href: '/app/schedule',
            type: 'unscheduled'
          });
        }
        
        setNeedsAttention(attentionItems);

        // Animate stroke after load
        setTimeout(() => {
          const circumference = 2 * Math.PI * 90;
          const percentage = totalCount > 0 ? (completedCount / totalCount) : 0;
          const offset = circumference - percentage * circumference;
          setStrokeOffset(offset);
        }, 100);

      } catch (err) {
        console.error('Failed to fetch dashboard data:', err);
      } finally {
        setDataLoading(false);
      }
    };

    fetchDashboardData();
  }, [session?.user?.id, authLoading]);

  // Render Loading / Shell
  if (authLoading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="w-8 h-8 border-4 border-primary-accent border-t-transparent rounded-full animate-spin"></div>
      </div>
    );
  }

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
        
        <AppMobileHeader onOpenMenu={() => setIsMobileMenuOpen(true)} />

        <div className="flex-1 flex flex-col items-center p-4 py-8 md:px-8 md:py-16">
          <div className="w-full max-w-4xl flex flex-col items-start space-y-12">
            
            <div className="w-full mb-4">
              <h1 className="font-serif italic font-bold text-4xl md:text-[40px] tracking-tight leading-[1.1] text-primary-text mb-3">
                Dashboard
              </h1>
              <p className="text-muted-text">
                Your week at a glance.
              </p>
            </div>

            {dataLoading ? (
              <div className="flex justify-center w-full py-12">
                <svg className="animate-spin h-6 w-6 text-muted-text" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                </svg>
              </div>
            ) : (
              <div className="w-full flex flex-col space-y-12">
                
                {/* TOP SECTION: Ring + Hero Stats */}
                <div className="flex flex-col md:flex-row items-center md:items-start gap-10 w-full">
                  
                  {/* Circular Progress Indicator */}
                  <div className="relative w-64 h-64 flex items-center justify-center shrink-0">
                    <svg className="w-full h-full transform -rotate-90 drop-shadow-2xl" viewBox="0 0 200 200">
                      <circle cx="100" cy="100" r="90" fill="transparent" stroke="#1A1714" strokeWidth="12" strokeLinecap="round" />
                      <circle cx="100" cy="100" r="90" fill="transparent" stroke="#FF5C38" strokeWidth="12" strokeLinecap="round" strokeDasharray={circumference} strokeDashoffset={strokeOffset} className="transition-all duration-1000 ease-out" />
                    </svg>
                    <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
                      <span className="text-5xl font-serif italic font-bold tracking-tight">{percentage}%</span>
                      <span className="text-sm text-muted-text font-medium mt-1 tracking-widest uppercase">{completedTasks} / {totalTasks}</span>
                    </div>
                  </div>

                  {/* Hero Stat Cards */}
                  <div className="grid grid-cols-2 gap-4 w-full h-full md:pt-4">
                    <div className="flex flex-col p-6 bg-card border border-hairline rounded-[24px] shadow-sm">
                      <span className="text-xs font-mono tracking-widest text-muted-text uppercase mb-2">Net Spend</span>
                      <span className={`text-2xl md:text-3xl font-serif italic font-bold ${netSpend > 0 ? 'text-green-400' : 'text-primary-text'}`}>
                        {netSpend > 0 ? '+' : ''}${netSpend.toFixed(2)}
                      </span>
                      <span className="text-xs text-muted-text mt-2">This week</span>
                    </div>
                    <div className="flex flex-col p-6 bg-card border border-hairline rounded-[24px] shadow-sm">
                      <span className="text-xs font-mono tracking-widest text-muted-text uppercase mb-2">Active Jobs</span>
                      <span className="text-2xl md:text-3xl font-serif italic font-bold text-primary-text">{activeJobApps}</span>
                      <span className="text-xs text-primary-accent mt-2">{upcomingRoundsCount} rounds this week</span>
                    </div>
                    <div className="flex flex-col p-6 bg-card border border-hairline rounded-[24px] shadow-sm col-span-2 md:col-span-1">
                      <span className="text-xs font-mono tracking-widest text-muted-text uppercase mb-2">Unscheduled</span>
                      <span className="text-2xl md:text-3xl font-serif italic font-bold text-primary-text">{unscheduledCount}</span>
                      <span className="text-xs text-muted-text mt-2">Items need placement</span>
                    </div>
                  </div>
                </div>

                {/* NEEDS ATTENTION SECTION */}
                <div className="flex flex-col w-full gap-4">
                  <h2 className="text-lg font-serif italic font-bold text-primary-text mb-2">Needs Attention</h2>
                  {needsAttention.length === 0 ? (
                    <div className="text-muted-text italic text-sm">All clear! Nothing urgent to review.</div>
                  ) : (
                    <div className="flex flex-col gap-3">
                      {needsAttention.map((item) => (
                        <Link key={item.id} href={item.href} className="flex items-center justify-between p-4 bg-card border border-hairline hover:border-white/10 hover:bg-white/5 rounded-2xl transition-all group">
                          <div className="flex items-center gap-4">
                            <div className="w-10 h-10 rounded-full bg-background flex items-center justify-center shrink-0 border border-white/5">
                              {item.type === 'overdue_task' && (
                                <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 text-primary-accent" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
                              )}
                              {item.type === 'budget' && (
                                <svg xmlns="http://www.w3.org/2000/svg" className={`h-5 w-5 ${item.color}`} fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
                              )}
                              {item.type === 'urgent_round' && (
                                <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 text-tertiary-accent" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 13.255A23.931 23.931 0 0112 15c-3.183 0-6.22-.62-9-1.745M16 6V4a2 2 0 00-2-2h-4a2 2 0 00-2 2v2m4 6h.01M5 20h14a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" /></svg>
                              )}
                              {item.type === 'unscheduled' && (
                                <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 text-secondary-accent" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" /></svg>
                              )}
                            </div>
                            <div className="flex flex-col">
                              <span className={`text-sm font-medium ${item.color || 'text-primary-text'}`}>{item.title}</span>
                              <span className="text-xs text-muted-text mt-0.5">{item.subtitle}</span>
                            </div>
                          </div>
                          <div className="text-muted-text opacity-0 group-hover:opacity-100 transition-opacity">
                            <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor"><path fillRule="evenodd" d="M7.293 14.707a1 1 0 010-1.414L10.586 10 7.293 6.707a1 1 0 011.414-1.414l4 4a1 1 0 010 1.414l-4 4a1 1 0 01-1.414 0z" clipRule="evenodd" /></svg>
                          </div>
                        </Link>
                      ))}
                    </div>
                  )}
                </div>

                {/* 7-DAY ACTIVITY STRIP */}
                <div className="flex flex-col w-full gap-4 pt-4 border-t border-white/5">
                  <h2 className="text-lg font-serif italic font-bold text-primary-text mb-2">Weekly Activity</h2>
                  <div className="flex justify-between md:justify-start gap-2 md:gap-4 overflow-x-auto pb-4 scrollbar-none">
                    {['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'].map(day => {
                      const count = activityByDay[day] || 0;
                      // Max color intensity logic
                      const opacity = count === 0 ? 0.05 : Math.min(0.2 + (count * 0.1), 1);
                      return (
                        <div key={day} className="flex flex-col items-center gap-2 min-w-[48px]">
                          <div 
                            className="w-10 h-10 rounded-lg flex items-center justify-center border border-white/5 transition-colors"
                            style={{ backgroundColor: `rgba(255, 92, 56, ${opacity})` }}
                          >
                            <span className={count > 0 ? 'text-white font-medium text-sm' : 'text-muted-text text-sm'}>
                              {count > 0 ? count : ''}
                            </span>
                          </div>
                          <span className="text-[10px] font-mono tracking-widest text-muted-text uppercase">{day}</span>
                        </div>
                      );
                    })}
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
