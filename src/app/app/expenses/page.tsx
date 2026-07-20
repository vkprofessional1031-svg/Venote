'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { supabase } from '@/lib/supabase';
import AppSidebar from '@/components/AppSidebar';
import AppMobileHeader from '@/components/AppMobileHeader';

interface Expense {
  id: string;
  amount: number;
  description: string;
  category: string;
  date: string;
  created_at: string;
  split_details?: string;
}

export default function ExpensesPage() {
  const router = useRouter();
  const [session, setSession] = useState<any>(null);
  const [authLoading, setAuthLoading] = useState(true);
  const [expenses, setExpenses] = useState<Expense[]>([]);
  const [loading, setLoading] = useState(true);
  
  // AI Quick Add state
  const [aiInput, setAiInput] = useState('');
  const [isProcessing, setIsProcessing] = useState(false);
  const [aiError, setAiError] = useState('');

  // Manual Add state
  const [showManualForm, setShowManualForm] = useState(false);
  const [manualForm, setManualForm] = useState({ amount: '', description: '', category: 'General', date: new Date().toISOString().split('T')[0] });
  
  // UI State
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
      setAuthLoading(false);
      if (!session) router.push('/login');
    });
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setSession(session);
      setAuthLoading(false);
      if (!session) router.push('/login');
    });
    return () => subscription.unsubscribe();
  }, [router]);

  useEffect(() => {
    if (authLoading || !session?.user?.id) return;
    const fetchExpenses = async () => {
      setLoading(true);
      const { data, error } = await supabase
        .from('expenses')
        .select('*')
        .eq('user_id', session.user.id)
        .order('date', { ascending: false })
        .order('created_at', { ascending: false });
      
      if (!error && data) {
        setExpenses(data);
      }
      setLoading(false);
    };
    fetchExpenses();
  }, [session, authLoading]);

  const handleAIQuickAdd = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!aiInput.trim() || !session) return;
    
    setIsProcessing(true);
    setAiError('');
    
    try {
      const response = await fetch('/api/structure', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text: aiInput })
      });
      
      if (!response.ok) throw new Error('Failed to process text');
      
      const data = await response.json();
      const results = data.results || [];
      
      const expenseItem = results.find((r: any) => r.type === 'expense');
      
      if (!expenseItem) {
        setAiError("Could not detect an expense. Try being more specific (e.g. 'Spent $15 on lunch') or use the manual form.");
        setIsProcessing(false);
        return;
      }
      
      const { error } = await supabase.from('expenses').insert({
        user_id: session.user.id,
        amount: expenseItem.amount || 0,
        description: expenseItem.title || 'Unknown Expense',
        category: expenseItem.category || 'General',
        date: expenseItem.date || new Date().toISOString().split('T')[0],
        split_details: expenseItem.split_details || null
      });
      
      if (error) throw error;
      
      // Refresh expenses
      const { data: newData } = await supabase
        .from('expenses')
        .select('*')
        .eq('user_id', session.user.id)
        .order('date', { ascending: false })
        .order('created_at', { ascending: false });
      if (newData) setExpenses(newData);
      
      setAiInput('');
    } catch (err: any) {
      console.error(err);
      setAiError(err.message || 'An error occurred.');
    } finally {
      setIsProcessing(false);
    }
  };

  const handleManualSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!manualForm.amount || !manualForm.description || !session) return;
    
    try {
      const { error } = await supabase.from('expenses').insert({
        user_id: session.user.id,
        amount: parseFloat(manualForm.amount),
        description: manualForm.description,
        category: manualForm.category || 'General',
        date: manualForm.date
      });
      
      if (error) throw error;
      
      // Refresh expenses
      const { data: newData } = await supabase
        .from('expenses')
        .select('*')
        .eq('user_id', session.user.id)
        .order('date', { ascending: false })
        .order('created_at', { ascending: false });
      if (newData) setExpenses(newData);
      
      setShowManualForm(false);
      setManualForm({ amount: '', description: '', category: 'General', date: new Date().toISOString().split('T')[0] });
    } catch (err) {
      console.error('Failed to add manual expense', err);
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Delete this expense?')) return;
    setExpenses(prev => prev.filter(e => e.id !== id));
    await supabase.from('expenses').delete().eq('id', id);
  };

  // Compute category breakdown
  const categoryTotals = expenses.reduce((acc, curr) => {
    acc[curr.category] = (acc[curr.category] || 0) + Number(curr.amount);
    return acc;
  }, {} as Record<string, number>);

  const totalSpent = Object.values(categoryTotals).reduce((a, b) => a + b, 0);

  if (authLoading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="w-8 h-8 border-4 border-primary-accent border-t-transparent rounded-full animate-spin"></div>
      </div>
    );
  }

  const displayName = session?.user?.user_metadata?.full_name 
    || session?.user?.email?.split('@')[0] 
    || 'User';

  return (
    <div className="flex h-screen bg-background overflow-hidden relative selection:bg-primary-accent/20">
      
      <AppSidebar 
        activePath="/app/expenses" 
        isMobileMenuOpen={isMobileMenuOpen} 
        onCloseMenu={() => setIsMobileMenuOpen(false)} 
        session={session}
        hideProfile={true}
      />

      {/* Main Content */}
      <main className="flex-1 flex flex-col h-full bg-background relative min-w-0">
        <AppMobileHeader onOpenMenu={() => setIsMobileMenuOpen(true)} />
        <div className="flex-1 overflow-y-auto p-4 md:p-8 custom-scrollbar">
          <div className="max-w-4xl mx-auto flex flex-col gap-8 h-full pb-32">
            
            <header>
              <h1 className="font-serif italic font-bold text-4xl text-primary-text tracking-tight mb-2">Expenses</h1>
              <p className="text-muted-text">Track and manage your spending.</p>
            </header>

            {/* AI Add Bar */}
            <div className="bg-card/50 backdrop-blur-md rounded-2xl p-4 border border-hairline shadow-sm relative group">
              <div className="absolute inset-0 rounded-2xl bg-gradient-to-r from-primary-accent/5 via-transparent to-transparent opacity-0 group-focus-within:opacity-100 transition-opacity duration-500 pointer-events-none" />
              <form onSubmit={handleAIQuickAdd} className="relative z-10 flex flex-col gap-3">
                <div className="flex flex-wrap sm:flex-nowrap items-center gap-3">
                  <div className="w-8 h-8 rounded-full bg-primary-accent/10 flex items-center justify-center flex-shrink-0">
                    <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 text-primary-accent" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
                    </svg>
                  </div>
                  <input
                    type="text"
                    placeholder="e.g. Spent $20 on lunch today..."
                    className="flex-1 min-w-0 bg-transparent text-primary-text placeholder:text-muted-text focus:outline-none text-[15px]"
                    value={aiInput}
                    onChange={(e) => setAiInput(e.target.value)}
                    disabled={isProcessing}
                  />
                  <button
                    type="submit"
                    disabled={!aiInput.trim() || isProcessing}
                    className="flex items-center justify-center gap-2 px-4 py-2 bg-primary-accent text-primary-text font-medium rounded-xl hover:brightness-110 disabled:opacity-50 disabled:hover:brightness-100 transition-all shadow-sm flex-shrink-0 whitespace-nowrap"
                  >
                    {isProcessing ? (
                      <div className="w-4 h-4 border-2 border-primary-text/30 border-t-primary-text rounded-full animate-spin" />
                    ) : (
                      <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                      </svg>
                    )}
                    <span className="hidden sm:inline">Add</span>
                  </button>
                </div>
                {aiError && (
                  <div className="text-red-400 text-xs px-11">{aiError}</div>
                )}
                <div className="px-11">
                  <button 
                    type="button" 
                    onClick={() => setShowManualForm(!showManualForm)}
                    className="text-xs text-primary-accent hover:underline focus:outline-none"
                  >
                    {showManualForm ? "Hide manual form" : "Add manually instead"}
                  </button>
                </div>
              </form>

              {/* Manual Form */}
              {showManualForm && (
                <div className="mt-4 pt-4 border-t border-hairline relative z-10">
                  <form onSubmit={handleManualSubmit} className="flex flex-col gap-4">
                    <div className="flex flex-col sm:flex-row gap-4">
                      <div className="flex-1">
                        <label className="block text-xs font-medium text-muted-text mb-1 uppercase tracking-wider">Amount</label>
                        <input
                          type="number"
                          step="0.01"
                          required
                          value={manualForm.amount}
                          onChange={(e) => setManualForm({...manualForm, amount: e.target.value})}
                          className="w-full bg-background border border-hairline rounded-xl px-3 py-2 text-primary-text focus:outline-none focus:border-muted-text"
                          placeholder="0.00"
                        />
                      </div>
                      <div className="flex-2 sm:w-1/2">
                        <label className="block text-xs font-medium text-muted-text mb-1 uppercase tracking-wider">Description</label>
                        <input
                          type="text"
                          required
                          value={manualForm.description}
                          onChange={(e) => setManualForm({...manualForm, description: e.target.value})}
                          className="w-full bg-background border border-hairline rounded-xl px-3 py-2 text-primary-text focus:outline-none focus:border-muted-text"
                          placeholder="e.g. Coffee"
                        />
                      </div>
                    </div>
                    <div className="flex flex-col sm:flex-row gap-4">
                      <div className="flex-1">
                        <label className="block text-xs font-medium text-muted-text mb-1 uppercase tracking-wider">Category</label>
                        <select
                          value={manualForm.category}
                          onChange={(e) => setManualForm({...manualForm, category: e.target.value})}
                          className="w-full bg-background border border-hairline rounded-xl px-3 py-2 text-primary-text focus:outline-none focus:border-muted-text appearance-none"
                        >
                          <option value="General">General</option>
                          <option value="Food & Dining">Food & Dining</option>
                          <option value="Transportation">Transportation</option>
                          <option value="Entertainment">Entertainment</option>
                          <option value="Shopping">Shopping</option>
                          <option value="Housing & Utilities">Housing & Utilities</option>
                        </select>
                      </div>
                      <div className="flex-1">
                        <label className="block text-xs font-medium text-muted-text mb-1 uppercase tracking-wider">Date</label>
                        <input
                          type="date"
                          required
                          value={manualForm.date}
                          onChange={(e) => setManualForm({...manualForm, date: e.target.value})}
                          className="w-full bg-background border border-hairline rounded-xl px-3 py-2 text-primary-text focus:outline-none focus:border-muted-text"
                        />
                      </div>
                    </div>
                    <div className="flex justify-end">
                      <button type="submit" className="px-4 py-2 bg-white/10 hover:bg-white/20 text-primary-text font-medium rounded-xl transition-all">
                        Save Expense
                      </button>
                    </div>
                  </form>
                </div>
              )}
            </div>

            {/* Dashboard Content */}
            {loading ? (
              <div className="flex items-center justify-center p-12">
                <div className="w-8 h-8 border-4 border-primary-accent border-t-transparent rounded-full animate-spin"></div>
              </div>
            ) : expenses.length === 0 ? (
              <div className="flex-1 flex flex-col items-center justify-center text-center opacity-60">
                <svg xmlns="http://www.w3.org/2000/svg" className="h-16 w-16 text-muted-text mb-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1} d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
                <p className="text-primary-text text-lg mb-2">No expenses yet</p>
                <p className="text-muted-text text-sm max-w-sm">Use the input above to quickly add expenses using AI, or add them manually.</p>
              </div>
            ) : (
              <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                
                {/* Left Col: Expense List */}
                <div className="lg:col-span-2 flex flex-col gap-4">
                  <h2 className="text-lg font-medium text-primary-text">Recent Expenses</h2>
                  <div className="bg-card border border-hairline rounded-2xl overflow-hidden shadow-sm">
                    {expenses.map((expense, idx) => (
                      <div key={expense.id} className={`flex items-start justify-between gap-3 p-4 hover:bg-white/5 transition-colors group ${idx !== expenses.length - 1 ? 'border-b border-hairline' : ''}`}>
                        <div className="flex items-start gap-3 flex-1 min-w-0">
                          <div className="w-10 h-10 rounded-full bg-background flex items-center justify-center border border-hairline text-muted-text flex-shrink-0 mt-0.5">
                            <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 10h18M7 15h1m4 0h1m-7 4h12a3 3 0 003-3V8a3 3 0 00-3-3H6a3 3 0 00-3 3v8a3 3 0 003 3z" />
                            </svg>
                          </div>
                          <div className="flex flex-col flex-1 min-w-0">
                            <div className="text-[15px] font-medium text-primary-text truncate">{expense.description}</div>
                            <div className="text-xs text-muted-text flex items-center gap-2 flex-wrap mt-0.5">
                              <span>{new Date(expense.date).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' })}</span>
                              <span className="w-1 h-1 rounded-full bg-hairline" />
                              <span className="text-primary-accent/80 font-medium whitespace-nowrap">{expense.category}</span>
                            </div>
                            {expense.split_details && (
                              <div className="text-xs text-muted-text/80 mt-1.5 pl-2 border-l-2 border-primary-accent/30 italic break-words whitespace-normal">
                                {expense.split_details}
                              </div>
                            )}
                          </div>
                        </div>
                        <div className="flex items-center gap-3 flex-shrink-0 ml-2 mt-0.5">
                          <div className="text-right font-serif italic font-bold text-lg text-primary-text">
                            ${Number(expense.amount).toFixed(2)}
                          </div>
                          <button 
                            onClick={() => handleDelete(expense.id)}
                            className="text-muted-text hover:text-red-400 opacity-0 group-hover:opacity-100 transition-opacity focus:outline-none p-1"
                            title="Delete"
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

                {/* Right Col: Breakdown */}
                <div className="flex flex-col gap-4">
                  <h2 className="text-lg font-medium text-primary-text">Breakdown</h2>
                  <div className="bg-card border border-hairline rounded-2xl p-5 shadow-sm flex flex-col gap-6">
                    <div>
                      <div className="text-xs text-muted-text uppercase tracking-wider mb-1">Total Spent</div>
                      <div className="text-3xl font-serif italic font-bold text-primary-text">
                        ${totalSpent.toFixed(2)}
                      </div>
                    </div>
                    
                    <div className="flex flex-col gap-3">
                      {Object.entries(categoryTotals).sort((a, b) => b[1] - a[1]).map(([cat, amount]) => {
                        const percent = totalSpent > 0 ? (amount / totalSpent) * 100 : 0;
                        return (
                          <div key={cat} className="flex flex-col gap-1.5">
                            <div className="flex justify-between text-sm">
                              <span className="text-primary-text">{cat}</span>
                              <span className="font-medium text-primary-text">${amount.toFixed(2)}</span>
                            </div>
                            <div className="w-full h-1.5 bg-background rounded-full overflow-hidden">
                              <div 
                                className="h-full bg-primary-accent rounded-full transition-all duration-1000" 
                                style={{ width: `${percent}%` }}
                              />
                            </div>
                          </div>
                        );
                      })}
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
