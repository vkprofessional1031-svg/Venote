'use client';

import { useState, useEffect, useRef } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { supabase } from '@/lib/supabase';
import { insertWalletItems } from '@/utils/transactions';
import AppSidebar from '@/components/AppSidebar';
import AppMobileHeader from '@/components/AppMobileHeader';
import { getCurrencySymbolFromLocale } from '@/lib/currency';

export interface SplitParticipant {
  name: string;
  amount: number;
  settled: boolean;
}

interface Expense {
  id: string;
  amount: number;
  description: string;
  category: string;
  date: string;
  created_at: string;
  split_details?: string;
  split_participants?: SplitParticipant[];
}

interface Income {
  id: string;
  amount: number;
  description: string;
  source: string;
  date: string;
  created_at: string;
}

interface CategoryBudget {
  id: string;
  user_id: string;
  category: string;
  monthly_limit: number;
}

const CURRENCIES = [
  { code: 'USD', symbol: '$' },
  { code: 'EUR', symbol: '€' },
  { code: 'GBP', symbol: '£' },
  { code: 'INR', symbol: '₹' },
  { code: 'JPY', symbol: '¥' },
  { code: 'AUD', symbol: 'A$' },
  { code: 'CAD', symbol: 'C$' },
];

const getCurrencySymbol = (code: string) => {
  const c = CURRENCIES.find(c => c.code === code);
  return c ? c.symbol : '$';
};

export default function ExpensesPage() {
  const router = useRouter();
  const [session, setSession] = useState<any>(null);
  const [authLoading, setAuthLoading] = useState(true);
  const [expenses, setExpenses] = useState<Expense[]>([]);
  const [incomes, setIncomes] = useState<Income[]>([]);
  const [loading, setLoading] = useState(true);
  
  // Swipe to delete state
  const [swipedTxId, setSwipedTxId] = useState<string | null>(null);
  const [touchStartX, setTouchStartX] = useState<number | null>(null);
  const [touchCurrentX, setTouchCurrentX] = useState<number | null>(null);

  const handleTouchStart = (e: React.TouchEvent, id: string) => {
    setTouchStartX(e.touches[0].clientX);
    setTouchCurrentX(e.touches[0].clientX);
  };

  const handleTouchMove = (e: React.TouchEvent, id: string) => {
    if (touchStartX === null) return;
    setTouchCurrentX(e.touches[0].clientX);
  };

  const handleTouchEnd = (e: React.TouchEvent, id: string) => {
    if (touchStartX === null || touchCurrentX === null) return;
    const diff = touchStartX - touchCurrentX;
    
    if (diff > 40) {
      setSwipedTxId(id);
    } else if (diff < -40) {
      if (swipedTxId === id) setSwipedTxId(null);
    }
    
    setTouchStartX(null);
    setTouchCurrentX(null);
  };
  
  // AI Quick Add state
  const [aiInput, setAiInput] = useState('');
  const [isProcessing, setIsProcessing] = useState(false);
  const [aiError, setAiError] = useState('');

  // Manual Add state
  const [showManualForm, setShowManualForm] = useState(false);
  const [manualEntryType, setManualEntryType] = useState<'expense' | 'income'>('expense');
  const [manualForm, setManualForm] = useState({ amount: '', description: '', category: 'General', source: '', date: '', receipt_url: '' });
  const [isMounted, setIsMounted] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const libraryInputRef = useRef<HTMLInputElement>(null);
  const mobileReceiptMenuRef = useRef<HTMLDivElement>(null);
  const [showMobileReceiptMenu, setShowMobileReceiptMenu] = useState(false);
  const [isUploadingReceipt, setIsUploadingReceipt] = useState(false);

  const handleReceiptUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !session?.user?.id) return;
    
    setIsUploadingReceipt(true);
    setAiError('');

    try {
      // 1. Upload to Supabase Storage
      const fileExt = file.name.split('.').pop();
      const fileName = `${Math.random().toString(36).substring(2, 15)}_${Date.now()}.${fileExt}`;
      const filePath = `${session.user.id}/${fileName}`;
      
      const { error: uploadError } = await supabase.storage.from('receipt-images').upload(filePath, file);
      if (uploadError) throw new Error('Failed to upload receipt image.');

      const { data: { publicUrl } } = supabase.storage.from('receipt-images').getPublicUrl(filePath);

      // 2. Pass public URL to Vision API
      const response = await fetch('/api/receipt-structure', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ imageUrl: publicUrl, currencySymbol: activeSymbol })
      });
      
      if (!response.ok) throw new Error('Failed to analyze receipt.');
      
      const data = await response.json();
      const result = data.result;
      
      if (!result) throw new Error('Could not parse receipt data.');
      
      // 3. Pre-fill manual form and open it
      setManualEntryType('expense');
      setManualForm({
        amount: result.amount ? String(result.amount) : '',
        description: result.merchant || '',
        category: result.category || 'General',
        source: '',
        date: result.date || new Date().toISOString().split('T')[0],
        receipt_url: publicUrl
      });
      setShowManualForm(true);
      
    } catch (err: any) {
      console.error(err);
      setAiError(err.message || 'Error processing receipt.');
    } finally {
      setIsUploadingReceipt(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
      if (libraryInputRef.current) libraryInputRef.current.value = '';
    }
  };

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (mobileReceiptMenuRef.current && !mobileReceiptMenuRef.current.contains(event.target as Node)) {
        setShowMobileReceiptMenu(false);
      }
    }
    
    function handleEscape(event: KeyboardEvent) {
      if (event.key === 'Escape') {
        setShowMobileReceiptMenu(false);
      }
    }

    if (showMobileReceiptMenu) {
      document.addEventListener('mousedown', handleClickOutside);
      document.addEventListener('keydown', handleEscape);
    }
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      document.removeEventListener('keydown', handleEscape);
    };
  }, [showMobileReceiptMenu]);

  useEffect(() => {
    setIsMounted(true);
    setManualForm(prev => ({ ...prev, date: new Date().toISOString().split('T')[0] }));
  }, []);
  
  // UI State
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [userCurrency, setUserCurrency] = useState<string | null>(null);

  // Budget State
  const [budgets, setBudgets] = useState<CategoryBudget[]>([]);
  const [isBudgetModalOpen, setIsBudgetModalOpen] = useState(false);
  const [budgetForm, setBudgetForm] = useState<Record<string, string>>({});

  // AI Summary State
  const [monthlySummary, setMonthlySummary] = useState<string | null>(null);
  const [summaryLoading, setSummaryLoading] = useState(true);
  const [summaryChecked, setSummaryChecked] = useState(false);
  const [isSummaryExpanded, setIsSummaryExpanded] = useState(false);
  const [expandedPerson, setExpandedPerson] = useState<string | null>(null);

  const activeSymbol = userCurrency 
    ? getCurrencySymbol(userCurrency) 
    : (isMounted ? getCurrencySymbolFromLocale() : '$');

  const now = new Date();
  const currentMonthStart = new Date(now.getFullYear(), now.getMonth(), 1).toISOString().split('T')[0];
  const nextMonthStart = new Date(now.getFullYear(), now.getMonth() + 1, 1).toISOString().split('T')[0];

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

  const reloadTransactions = async () => {
    if (!session) return;
    const [expensesResponse, incomesResponse] = await Promise.all([
      supabase
        .from('expenses')
        .select('*')
        .eq('user_id', session.user.id)
        .order('date', { ascending: false })
        .order('created_at', { ascending: false }),
      supabase
        .from('income')
        .select('*')
        .eq('user_id', session.user.id)
        .order('date', { ascending: false })
        .order('created_at', { ascending: false })
    ]);
    
    if (!expensesResponse.error && expensesResponse.data) {
      setExpenses(expensesResponse.data);
    }
    if (!incomesResponse.error && incomesResponse.data) {
      setIncomes(incomesResponse.data);
    }
  };

  useEffect(() => {
    if (authLoading || !session?.user?.id) return;

    const fetchSettings = async () => {
      const { data, error } = await supabase
        .from('user_settings')
        .select('currency')
        .eq('user_id', session.user.id)
        .single();
        
      if (data && data.currency) {
        setUserCurrency(data.currency);
      } else if (error && error.code === 'PGRST116') {
        // No row found, insert default null (auto) row
        await supabase.from('user_settings').insert({
          user_id: session.user.id,
          currency: null
        });
      }
    };
    fetchSettings();

    const fetchExpensesAndIncomes = async () => {
      setLoading(true);
      await reloadTransactions();
      setLoading(false);
    };
    const fetchBudgets = async () => {
      try {
        const { data } = await supabase.from('category_budgets').select('*').eq('user_id', session.user.id);
        if (data) setBudgets(data);
      } catch (e) {
        console.error('Failed to fetch budgets, skipping.', e);
      }
    };
    fetchBudgets();
    fetchExpensesAndIncomes();
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
        body: JSON.stringify({ text: aiInput, currencySymbol: activeSymbol, domain: 'wallet' })
      });
      
      if (!response.ok) throw new Error('Failed to process text');
      
      const data = await response.json();
      const results = data.results || [];
      
      const validItems = results.filter((r: any) => r.type === 'expense' || r.type === 'income');
      
      if (validItems.length === 0) {
        setAiError("Could not detect any expenses or incomes. Try being more specific (e.g. 'Spent $15 on lunch') or use the manual form.");
        setIsProcessing(false);
        return;
      }
      
      await insertWalletItems(validItems, session.user.id, supabase);
      
      await reloadTransactions();
      
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
      if (manualEntryType === 'income') {
        const { error } = await supabase.from('income').insert({
          user_id: session.user.id,
          amount: parseFloat(manualForm.amount),
          description: manualForm.description,
          source: manualForm.source || 'General',
          date: manualForm.date
        });
        if (error) throw error;
      } else {
        const { error } = await supabase.from('expenses').insert({
          user_id: session.user.id,
          amount: parseFloat(manualForm.amount),
          description: manualForm.description,
          category: manualForm.category || 'General',
          date: manualForm.date,
          receipt_url: manualForm.receipt_url || null
        });
        if (error) throw error;
      }
      
      await reloadTransactions();
      
      setShowManualForm(false);
      setManualForm({ amount: '', description: '', category: 'General', source: '', date: new Date().toISOString().split('T')[0], receipt_url: '' });
    } catch (err) {
      console.error('Failed to add manual entry', err);
    }
  };

  const handleDelete = async (id: string, isIncome: boolean = false) => {
    if (!confirm(`Delete this ${isIncome ? 'income' : 'expense'}?`)) return;
    if (isIncome) {
      setIncomes(prev => prev.filter(e => e.id !== id));
      await supabase.from('income').delete().eq('id', id);
    } else {
      setExpenses(prev => prev.filter(e => e.id !== id));
      await supabase.from('expenses').delete().eq('id', id);
    }
  };

  // Compute category breakdown
  const categoryTotals = expenses.reduce((acc, curr) => {
    acc[curr.category] = (acc[curr.category] || 0) + Number(curr.amount);
    return acc;
  }, {} as Record<string, number>);

  const totalSpent = Object.values(categoryTotals).reduce((a, b) => a + b, 0);

  const currentMonthIncome = incomes.reduce((acc, curr) => {
    if (curr.date >= currentMonthStart && curr.date < nextMonthStart) {
      return acc + Number(curr.amount);
    }
    return acc;
  }, 0);

  const netBalance = currentMonthIncome - totalSpent;

  const currentMonthTotals = expenses.reduce((acc, curr) => {
    if (curr.date >= currentMonthStart && curr.date < nextMonthStart) {
      acc[curr.category] = (acc[curr.category] || 0) + Number(curr.amount);
    }
    return acc;
  }, {} as Record<string, number>);

  const allKnownCategories = Array.from(new Set([
    ...expenses.map(e => e.category),
    'General', 'Food & Dining', 'Transportation', 'Entertainment', 'Shopping', 'Housing & Utilities'
  ]));

  const openBudgetModal = () => {
    const initialForm: Record<string, string> = {};
    budgets.forEach(b => {
      initialForm[b.category] = String(b.monthly_limit);
    });
    setBudgetForm(initialForm);
    setIsBudgetModalOpen(true);
  };

  // --- SETTLE UP LOGIC ---
  interface DebtLineItem {
    expenseId: string;
    description: string;
    date: string;
    amount: number;
    settled: boolean;
  }
  
  const settleUpData: Record<string, { totalOwed: number, items: DebtLineItem[] }> = {};
  expenses.forEach(expense => {
    if (expense.split_participants && Array.isArray(expense.split_participants)) {
      expense.split_participants.forEach(participant => {
        if (!participant.settled) {
          if (!settleUpData[participant.name]) {
            settleUpData[participant.name] = { totalOwed: 0, items: [] };
          }
          settleUpData[participant.name].totalOwed += participant.amount;
          settleUpData[participant.name].items.push({
            expenseId: expense.id,
            description: expense.description,
            date: expense.date,
            amount: participant.amount,
            settled: participant.settled
          });
        }
      });
    }
  });

  const peopleOwingMoney = Object.entries(settleUpData).filter(([_, data]) => data.totalOwed > 0);

  const handleMarkAsSettled = async (expenseId: string, personName: string) => {
    const expense = expenses.find(e => e.id === expenseId);
    if (!expense || !expense.split_participants) return;

    const updatedParticipants = expense.split_participants.map(p => {
      if (p.name === personName) {
        return { ...p, settled: true };
      }
      return p;
    });

    // Optimistic update
    setExpenses(prev => prev.map(e => {
      if (e.id === expenseId) {
        return { ...e, split_participants: updatedParticipants };
      }
      return e;
    }));

    try {
      const { error } = await supabase
        .from('expenses')
        .update({ split_participants: updatedParticipants })
        .eq('id', expenseId);
      
      if (error) throw error;
    } catch (err) {
      console.error('Failed to mark as settled', err);
    }
  };

  const handleSaveBudgets = async () => {
    if (!session?.user?.id) return;
    
    const updates = [];
    const deletes = [];
    
    for (const cat of allKnownCategories) {
      const val = budgetForm[cat];
      if (val && !isNaN(Number(val)) && Number(val) > 0) {
        updates.push({
          user_id: session.user.id,
          category: cat,
          monthly_limit: Number(val),
          updated_at: new Date().toISOString()
        });
      } else {
        deletes.push(cat);
      }
    }
    
    try {
      if (updates.length > 0) {
        await supabase.from('category_budgets').upsert(updates, { onConflict: 'user_id, category' });
      }
      if (deletes.length > 0) {
        await supabase.from('category_budgets').delete().eq('user_id', session.user.id).in('category', deletes);
      }
      const { data } = await supabase.from('category_budgets').select('*').eq('user_id', session.user.id);
      if (data) setBudgets(data);
    } catch (e) {
      console.error(e);
      alert('Failed to save budgets. Did you run the SQL migration?');
    }
    
    setIsBudgetModalOpen(false);
  };

  useEffect(() => {
    if (loading || !session?.user?.id || summaryChecked) return;
    
    const checkAndGenerateSummary = async () => {
      setSummaryLoading(true);
      try {
        const currentMonthString = currentMonthStart;
        
        const { data: existing } = await supabase
          .from('monthly_summaries')
          .select('*')
          .eq('user_id', session.user.id)
          .eq('month', currentMonthString)
          .single();
          
        if (existing && existing.summary_text) {
          setMonthlySummary(existing.summary_text);
        } else {
          const currentMonthExpenses = expenses.filter(e => e.date >= currentMonthStart && e.date < nextMonthStart);
          if (currentMonthExpenses.length === 0) {
            setMonthlySummary(null);
          } else {
            const budgetMap: Record<string, number> = {};
            budgets.forEach(b => budgetMap[b.category] = b.monthly_limit);
            
            const currentMonthTotalsObj = currentMonthExpenses.reduce((acc, curr) => {
              acc[curr.category] = (acc[curr.category] || 0) + Number(curr.amount);
              return acc;
            }, {} as Record<string, number>);
            const currentMonthTotal = Object.values(currentMonthTotalsObj).reduce((a, b) => a + b, 0);

            const currentMonthTotalIncome = incomes.reduce((acc, curr) => {
              if (curr.date >= currentMonthStart && curr.date < nextMonthStart) {
                return acc + Number(curr.amount);
              }
              return acc;
            }, 0);
            const currentMonthNetBalance = currentMonthTotalIncome - currentMonthTotal;

            const res = await fetch('/api/summary', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                totalSpent: currentMonthTotal,
                categoryTotals: currentMonthTotalsObj,
                budgets: budgetMap,
                totalIncome: currentMonthTotalIncome,
                netBalance: currentMonthNetBalance,
                currencySymbol: activeSymbol
              })
            });
            const data = await res.json();
            if (data.summary) {
              setMonthlySummary(data.summary);
              await supabase.from('monthly_summaries').insert({
                user_id: session.user.id,
                month: currentMonthString,
                summary_text: data.summary
              });
            }
          }
        }
      } catch (err) {
        console.error('Error fetching/generating summary', err);
      } finally {
        setSummaryLoading(false);
        setSummaryChecked(true);
      }
    };
    
    checkAndGenerateSummary();
  }, [loading, session, expenses, incomes, budgets, currentMonthStart, nextMonthStart, activeSymbol, summaryChecked]);

  const handleRegenerateSummary = async () => {
    if (!session?.user?.id) return;
    setSummaryLoading(true);
    try {
      const currentMonthExpenses = expenses.filter(e => e.date >= currentMonthStart && e.date < nextMonthStart);
      if (currentMonthExpenses.length === 0) {
        setMonthlySummary(null);
        setSummaryLoading(false);
        return;
      }
      
      const budgetMap: Record<string, number> = {};
      budgets.forEach(b => budgetMap[b.category] = b.monthly_limit);
      const currentMonthTotalsObj = currentMonthExpenses.reduce((acc, curr) => {
        acc[curr.category] = (acc[curr.category] || 0) + Number(curr.amount);
        return acc;
      }, {} as Record<string, number>);
      const currentMonthTotal = Object.values(currentMonthTotalsObj).reduce((a, b) => a + b, 0);

      const currentMonthTotalIncome = incomes.reduce((acc, curr) => {
        if (curr.date >= currentMonthStart && curr.date < nextMonthStart) {
          return acc + Number(curr.amount);
        }
        return acc;
      }, 0);
      const currentMonthNetBalance = currentMonthTotalIncome - currentMonthTotal;

      const res = await fetch('/api/summary', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          totalSpent: currentMonthTotal,
          categoryTotals: currentMonthTotalsObj,
          budgets: budgetMap,
          totalIncome: currentMonthTotalIncome,
          netBalance: currentMonthNetBalance,
          currencySymbol: activeSymbol
        })
      });
      const data = await res.json();
      if (data.summary) {
        setMonthlySummary(data.summary);
        await supabase.from('monthly_summaries').upsert({
          user_id: session.user.id,
          month: currentMonthStart,
          summary_text: data.summary,
          generated_at: new Date().toISOString()
        }, { onConflict: 'user_id, month' });
      }
    } catch (err) {
      console.error('Failed to regenerate summary', err);
    } finally {
      setSummaryLoading(false);
    }
  };

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
  const allTransactions = [
    ...expenses.map(e => ({ ...e, isIncome: false })),
    ...incomes.map(i => ({ ...i, isIncome: true, category: i.source }))
  ].sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime() || new Date(b.created_at).getTime() - new Date(a.created_at).getTime());


  return (
    <div className="flex h-screen bg-background overflow-hidden relative selection:bg-primary-accent/20">
      
      <AppSidebar 
        activePath="/app/expenses" 
        isMobileMenuOpen={isMobileMenuOpen} 
        onCloseMenu={() => setIsMobileMenuOpen(false)} 
        session={session}
      />

      {/* Main Content */}
      <main className="flex-1 flex flex-col h-full bg-background relative min-w-0">
        <AppMobileHeader onOpenMenu={() => setIsMobileMenuOpen(true)} />
        <div className="flex-1 overflow-y-auto p-4 md:p-8 custom-scrollbar">
          <div className="max-w-4xl mx-auto flex flex-col gap-8 min-h-full pb-8">
            
            <header className="flex flex-col sm:flex-row sm:items-start justify-between gap-4">
              <div>
                <h1 className="font-serif italic font-bold text-4xl text-primary-text tracking-tight mb-2">Wallet</h1>
                <p className="text-muted-text text-sm">Track your transactions and spending.</p>
              </div>
            </header>

            {/* Hero Card */}
            <div className="glass-panel-modal rounded-[24px] p-6 sm:p-8 text-white shadow-[0_8px_32px_rgba(255,92,56,0.15)] border border-primary-accent/20 relative overflow-hidden mt-2">
              {/* Background texture (dot grid) */}
              <div className="absolute inset-0 pointer-events-none opacity-20" style={{ backgroundImage: 'radial-gradient(rgba(255, 255, 255, 0.8) 1px, transparent 1px)', backgroundSize: '12px 12px' }}></div>
              
              {/* Decorative circles */}
              <div className="absolute -top-20 -right-20 w-64 h-64 bg-white/10 rounded-full blur-3xl pointer-events-none"></div>
              <div className="absolute -bottom-32 -left-16 w-80 h-80 bg-white/10 rounded-full blur-3xl pointer-events-none"></div>
              <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-40 h-40 bg-white/5 rounded-full blur-2xl pointer-events-none"></div>
              
              <div className="relative z-10 flex flex-col gap-8 sm:gap-10">
                <div className="flex justify-between items-center">
                  <div className="w-11 h-7 rounded-md bg-gradient-to-br from-[#d4af7a] to-[#8a6d3f] border border-[#f0cfa0]/30 shadow-sm flex items-center justify-center overflow-hidden relative">
                    <div className="absolute w-full h-[1px] bg-black/20 top-[35%]"></div>
                    <div className="absolute w-full h-[1px] bg-black/20 bottom-[35%]"></div>
                    <div className="absolute h-full w-[1px] bg-black/20 left-[35%]"></div>
                    <div className="absolute h-full w-[1px] bg-black/20 right-[35%]"></div>
                    <div className="w-6 h-3 border border-black/20 rounded-[2px] absolute"></div>
                  </div>
                  <div className="font-bold tracking-[0.2em] text-sm text-white/90 uppercase">VENOTE</div>
                </div>
                
                <div className="flex flex-col gap-1">
                  <div className="text-[11px] font-medium tracking-widest text-white/70 uppercase">Net Balance</div>
                  <div className={`text-4xl sm:text-5xl font-medium tracking-tight ${netBalance < 0 ? 'text-[#FFD3D3]' : 'text-[#D3FFDF]'}`}>
                    {netBalance < 0 ? '-' : ''}{activeSymbol}{Math.abs(netBalance).toFixed(2)}
                  </div>
                </div>
                
                <div className="flex justify-between items-end mt-2">
                  <div className="flex gap-6">
                    <div className="flex flex-col gap-1">
                      <div className="text-[10px] font-medium tracking-widest text-white/60 uppercase">Total Income</div>
                      <div className="text-sm font-medium tracking-tight text-white/90">
                        {activeSymbol}{currentMonthIncome.toFixed(2)}
                      </div>
                    </div>
                    <div className="flex flex-col gap-1">
                      <div className="text-[10px] font-medium tracking-widest text-white/60 uppercase">Total Spent</div>
                      <div className="text-sm font-medium tracking-tight text-white/90">
                        {activeSymbol}{totalSpent.toFixed(2)}
                      </div>
                    </div>
                  </div>
                  <div className="text-xs font-medium text-white/70 uppercase tracking-widest pb-1">
                    {isMounted ? new Date().toLocaleString('default', { month: 'short' }) : ''} {isMounted ? new Date().getFullYear() : ''}
                  </div>
                </div>
              </div>
            </div>

            {/* Action Buttons */}
            <div className="flex gap-4">
              <button 
                onClick={openBudgetModal} 
                className="flex-1 py-3 px-4 rounded-xl border border-primary-accent text-primary-accent font-medium hover:bg-primary-accent/10 transition-colors shadow-sm text-sm"
              >
                Set budgets
              </button>
              <button 
                onClick={() => setShowManualForm(true)} 
                className="flex-1 py-3 px-4 rounded-xl bg-primary-accent text-[#1A1714] font-medium hover:brightness-110 shadow-[0_4px_14px_0_rgba(255,92,56,0.39)] transition-all text-sm"
              >
                Add Transaction
              </button>
            </div>

            {/* AI Add Bar */}
            <div className="glass-panel-modal rounded-[24px] p-4 border border-white/10 shadow-sm relative group">
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
                    placeholder={`e.g. Spent ${activeSymbol}20 on lunch today...`}
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
                <div className="px-11 flex items-center justify-between">
                  <button 
                    type="button" 
                    onClick={() => setShowManualForm(!showManualForm)}
                    className="text-xs text-primary-accent hover:underline focus:outline-none"
                  >
                    {showManualForm ? "Hide manual form" : "Add manually instead"}
                  </button>

                  <div className="flex items-center gap-2 relative">
                    <input 
                      type="file" 
                      accept="image/*" 
                      capture="environment" 
                      className="hidden" 
                      ref={fileInputRef} 
                      onChange={handleReceiptUpload} 
                    />
                    <input 
                      type="file" 
                      accept="image/*" 
                      className="hidden" 
                      ref={libraryInputRef} 
                      onChange={handleReceiptUpload} 
                    />
                    
                    {/* Desktop Button - Hidden on mobile */}
                    <button
                      type="button"
                      onClick={() => libraryInputRef.current?.click()}
                      disabled={isUploadingReceipt}
                      className="hidden md:flex items-center gap-1.5 text-xs text-muted-text hover:text-primary-text transition-colors disabled:opacity-50"
                      title="Upload Receipt"
                    >
                      {isUploadingReceipt ? (
                        <div className="w-4 h-4 border-2 border-primary-text/30 border-t-primary-text rounded-full animate-spin" />
                      ) : (
                        <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 9a2 2 0 012-2h.93a2 2 0 001.664-.89l.812-1.22A2 2 0 0110.07 4h3.86a2 2 0 011.664.89l.812 1.22A2 2 0 0018.07 7H19a2 2 0 012 2v9a2 2 0 01-2 2H5a2 2 0 01-2-2V9z" />
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 13a3 3 0 11-6 0 3 3 0 016 0z" />
                        </svg>
                      )}
                      <span>{isUploadingReceipt ? "Analyzing..." : "Scan Receipt"}</span>
                    </button>

                    {/* Mobile Button - Hidden on desktop */}
                    <button
                      type="button"
                      onClick={() => setShowMobileReceiptMenu(true)}
                      disabled={isUploadingReceipt}
                      className="flex md:hidden items-center gap-1.5 text-xs text-muted-text hover:text-primary-text transition-colors disabled:opacity-50"
                      title="Scan Receipt Options"
                    >
                      {isUploadingReceipt ? (
                        <div className="w-4 h-4 border-2 border-primary-text/30 border-t-primary-text rounded-full animate-spin" />
                      ) : (
                        <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 9a2 2 0 012-2h.93a2 2 0 001.664-.89l.812-1.22A2 2 0 0110.07 4h3.86a2 2 0 011.664.89l.812 1.22A2 2 0 0018.07 7H19a2 2 0 012 2v9a2 2 0 01-2 2H5a2 2 0 01-2-2V9z" />
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 13a3 3 0 11-6 0 3 3 0 016 0z" />
                        </svg>
                      )}
                      <span>{isUploadingReceipt ? "Analyzing..." : "Scan Receipt"}</span>
                    </button>

                    {/* Mobile Receipt Menu Popup */}
                    {showMobileReceiptMenu && (
                      <div ref={mobileReceiptMenuRef} className="absolute right-0 top-full mt-2 w-48 bg-background border border-hairline rounded-xl shadow-lg overflow-hidden z-[60] md:hidden animate-in fade-in zoom-in-95 duration-200">
                        <button
                          type="button"
                          onClick={() => {
                            fileInputRef.current?.click();
                            setShowMobileReceiptMenu(false);
                          }}
                          className="w-full px-4 py-3 text-sm text-left text-primary-text hover:bg-white/5 flex items-center gap-2"
                        >
                          <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 text-muted-text" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 9a2 2 0 012-2h.93a2 2 0 001.664-.89l.812-1.22A2 2 0 0110.07 4h3.86a2 2 0 011.664.89l.812 1.22A2 2 0 0018.07 7H19a2 2 0 012 2v9a2 2 0 01-2 2H5a2 2 0 01-2-2V9z" />
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 13a3 3 0 11-6 0 3 3 0 016 0z" />
                          </svg>
                          Take Photo
                        </button>
                        <div className="h-px bg-hairline" />
                        <button
                          type="button"
                          onClick={() => {
                            libraryInputRef.current?.click();
                            setShowMobileReceiptMenu(false);
                          }}
                          className="w-full px-4 py-3 text-sm text-left text-primary-text hover:bg-white/5 flex items-center gap-2"
                        >
                          <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 text-muted-text" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                          </svg>
                          Choose from Library
                        </button>
                      </div>
                    )}
                  </div>
                </div>
              </form>

              {/* Manual Form */}
              {showManualForm && (
                <div className="mt-4 pt-4 border-t border-hairline relative z-10">
                  <div className="flex bg-background border border-hairline rounded-xl p-1 mb-4">
                    <button
                      type="button"
                      onClick={() => setManualEntryType('expense')}
                      className={`flex-1 py-1.5 text-xs font-medium rounded-lg transition-colors ${manualEntryType === 'expense' ? 'bg-white/10 text-primary-text shadow-sm' : 'text-muted-text hover:text-primary-text'}`}
                    >
                      Expense
                    </button>
                    <button
                      type="button"
                      onClick={() => setManualEntryType('income')}
                      className={`flex-1 py-1.5 text-xs font-medium rounded-lg transition-colors ${manualEntryType === 'income' ? 'bg-[#D3FFDF]/10 text-[#D3FFDF] shadow-sm' : 'text-muted-text hover:text-[#D3FFDF]'}`}
                    >
                      Income
                    </button>
                  </div>
                  <form onSubmit={handleManualSubmit} className="flex flex-col gap-4">
                    <div className="flex flex-col sm:flex-row gap-4">
                      <div className="flex-1">
                        <label className="block text-xs font-medium text-muted-text mb-1 uppercase tracking-wider">Amount</label>
                        <div className="relative">
                          <span className="absolute left-3 top-2 text-muted-text">{activeSymbol}</span>
                          <input
                            type="number"
                            step="0.01"
                            required
                            value={manualForm.amount}
                            onChange={(e) => setManualForm({...manualForm, amount: e.target.value})}
                            className="w-full bg-background border border-hairline rounded-xl pl-7 pr-3 py-2 text-primary-text focus:outline-none focus:border-muted-text"
                            placeholder="0.00"
                          />
                        </div>
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
                        <label className="block text-xs font-medium text-muted-text mb-1 uppercase tracking-wider">
                          {manualEntryType === 'income' ? 'Source' : 'Category'}
                        </label>
                        {manualEntryType === 'income' ? (
                          <input
                            type="text"
                            required
                            value={manualForm.source || ''}
                            onChange={(e) => setManualForm({...manualForm, source: e.target.value})}
                            className="w-full bg-background border border-hairline rounded-xl px-3 py-2 text-primary-text focus:outline-none focus:border-muted-text"
                            placeholder="e.g. Salary, Freelance"
                          />
                        ) : (
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
                        )}
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
                      <button 
                        type="submit"
                        className="w-full bg-primary-accent text-primary-text font-medium rounded-xl px-4 py-2.5 hover:brightness-110 transition-all shadow-[0_4px_14px_0_rgba(255,92,56,0.39)]"
                      >
                        Save Transaction
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
            ) : allTransactions.length === 0 ? (
              <div className="flex-1 flex flex-col items-center justify-center text-center opacity-60">
                <svg xmlns="http://www.w3.org/2000/svg" className="h-16 w-16 text-muted-text mb-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1} d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
                <p className="text-primary-text text-lg mb-2">No expenses yet</p>
                <p className="text-muted-text text-sm max-w-sm">Use the input above to quickly add expenses using AI, or add them manually.</p>
              </div>
            ) : (
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                
                {/* Left Col: Primary Layout (Recent + Settle Up) */}
                <div className="flex flex-col gap-6">
                  
                  {/* Recent Transactions */}
                  <div className="flex flex-col gap-3">
                    <h2 className="text-xs font-medium text-muted-text uppercase tracking-wider pl-1">Recent</h2>
                    <div className="glass-panel-modal rounded-[24px] border border-white/10 shadow-[0_8px_32px_rgba(0,0,0,0.3)] overflow-hidden">
                      {allTransactions.map((tx, idx) => {
                        const uniqueId = `${tx.id}-${tx.isIncome}`;
                        return (
                        <div key={uniqueId} className={`group relative w-full overflow-hidden ${idx !== allTransactions.length - 1 ? 'border-b border-white/10' : ''}`}>
                          <div 
                            className="flex w-full transition-transform duration-300 ease-out"
                            style={{ transform: swipedTxId === uniqueId ? 'translateX(-80px)' : 'translateX(0)' }}
                          >
                            <div
                              onClick={() => { if (swipedTxId === uniqueId) setSwipedTxId(null); }}
                              onTouchStart={(e) => handleTouchStart(e, uniqueId)}
                              onTouchMove={(e) => handleTouchMove(e, uniqueId)}
                              onTouchEnd={(e) => handleTouchEnd(e, uniqueId)}
                              className="w-full shrink-0 flex items-start justify-between gap-3 p-5 hover:bg-white/5 transition-colors cursor-pointer md:cursor-default"
                            >
                              <div className="flex items-start gap-3 flex-1 min-w-0">
                                <div className="w-10 h-10 rounded-full bg-background flex items-center justify-center border border-white/10 text-muted-text flex-shrink-0 mt-0.5">
                                  {tx.isIncome ? (
                                    <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 text-green-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                                    </svg>
                                  ) : (
                                    <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 10h18M7 15h1m4 0h1m-7 4h12a3 3 0 003-3V8a3 3 0 00-3-3H6a3 3 0 00-3 3v8a3 3 0 003 3z" />
                                    </svg>
                                  )}
                                </div>
                                <div className="flex flex-col flex-1 min-w-0">
                                  <div className="text-[15px] font-medium text-primary-text truncate">{tx.description}</div>
                                  <div className="text-xs text-muted-text flex items-center gap-2 flex-wrap mt-0.5">
                                    <span>{isMounted ? new Date(tx.date).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' }) : tx.date}</span>
                                    <span className="w-1 h-1 rounded-full bg-white/20" />
                                    <span className="text-primary-accent/80 font-medium whitespace-nowrap">{tx.category}</span>
                                  </div>
                                  {(!tx.isIncome && (tx as any).split_details) && (
                                    <div className="text-xs text-muted-text/80 mt-1.5 pl-2 border-l-2 border-primary-accent/30 italic break-words whitespace-normal">
                                      {(tx as any).split_details}
                                    </div>
                                  )}
                                </div>
                              </div>
                              <div className="flex items-center gap-3 flex-shrink-0 ml-2 mt-0.5">
                                <div className={`text-right font-medium tracking-tight text-lg ${tx.isIncome ? 'text-green-400' : 'text-primary-text'}`}>
                                  {tx.isIncome ? '+' : '-'}{activeSymbol}{Number(tx.amount).toFixed(2)}
                                </div>
                                <button 
                                  onClick={() => handleDelete(tx.id, tx.isIncome)}
                                  className="hidden md:block text-muted-text hover:text-red-400 opacity-0 group-hover:opacity-100 transition-opacity focus:outline-none p-1"
                                  title="Delete"
                                >
                                  <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                                  </svg>
                                </button>
                              </div>
                            </div>
                            
                            {/* Mobile Swipe Actions */}
                            <div className="w-[80px] shrink-0 flex items-stretch md:hidden bg-background">
                              <button onClick={(e) => { e.stopPropagation(); handleDelete(tx.id, tx.isIncome); setSwipedTxId(null); }} className="w-full flex flex-col items-center justify-center bg-red-600 text-white transition-opacity active:opacity-70">
                                <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 mb-1" viewBox="0 0 20 20" fill="currentColor">
                                  <path fillRule="evenodd" d="M9 2a1 1 0 00-.894.553L7.382 4H4a1 1 0 000 2v10a2 2 0 002 2h8a2 2 0 002-2V6a1 1 0 100-2h-3.382l-.724-1.447A1 1 0 0011 2H9zM7 8a1 1 0 012 0v6a1 1 0 11-2 0V8zm5-1a1 1 0 00-1 1v6a1 1 0 102 0V8a1 1 0 00-1-1z" clipRule="evenodd" />
                                </svg>
                                <span className="text-[10px] font-medium">Delete</span>
                              </button>
                            </div>
                          </div>
                        </div>
                        );
                      })}
                    </div>
                  </div>

                  {/* Settle Up Section */}
                  {peopleOwingMoney.length > 0 && (
                    <div className="flex flex-col gap-3">
                      <h2 className="text-xs font-medium text-muted-text uppercase tracking-wider pl-1">Settle Up</h2>
                      <div className="glass-panel-modal rounded-[24px] border border-white/10 shadow-[0_8px_32px_rgba(0,0,0,0.3)] p-5 flex flex-col gap-4">
                        {peopleOwingMoney.map(([name, data]) => (
                          <div key={name} className="flex flex-col gap-2">
                            <div 
                              className="flex justify-between items-center cursor-pointer select-none group"
                              onClick={() => setExpandedPerson(expandedPerson === name ? null : name)}
                            >
                              <div>
                                <span className="font-medium text-primary-text group-hover:text-primary-accent transition-colors">{name}</span>
                                <span className="text-sm text-muted-text ml-2">owes you {activeSymbol}{data.totalOwed.toFixed(2)} ({data.items.length} {data.items.length === 1 ? 'expense' : 'expenses'})</span>
                              </div>
                              <svg xmlns="http://www.w3.org/2000/svg" className={`h-4 w-4 text-muted-text transition-transform duration-300 ${expandedPerson === name ? 'rotate-180' : ''}`} fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                              </svg>
                            </div>
                            
                            {expandedPerson === name && (
                              <div className="mt-2 pl-4 border-l-2 border-white/10 flex flex-col gap-3">
                                {data.items.map(item => (
                                  <div key={item.expenseId} className="flex flex-col gap-1">
                                    <div className="flex justify-between text-sm">
                                      <span className="text-primary-text">{item.description} <span className="text-muted-text text-xs ml-1">{new Date(item.date).toLocaleDateString()}</span></span>
                                      <span className="font-medium text-primary-text">{activeSymbol}{item.amount.toFixed(2)}</span>
                                    </div>
                                    <button 
                                      onClick={() => handleMarkAsSettled(item.expenseId, name)}
                                      className="self-start text-xs text-primary-accent border border-primary-accent/30 bg-primary-accent/5 hover:bg-primary-accent/10 px-2 py-1 rounded transition-colors"
                                    >
                                      Mark as settled
                                    </button>
                                  </div>
                                ))}
                              </div>
                            )}
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>

                {/* Right Col: Budgets & Breakdown */}
                <div className="flex flex-col gap-6">
                  
                  {/* AI Summary Strip */}
                  <div className="glass-panel-modal rounded-[24px] border border-white/10 shadow-[0_8px_32px_rgba(0,0,0,0.3)] relative group overflow-hidden">
                    <div className="absolute inset-0 bg-gradient-to-r from-primary-accent/5 to-transparent opacity-50 pointer-events-none" />
                    <div className="relative z-10 p-4">
                      <div 
                        className="flex justify-between items-center cursor-pointer select-none"
                        onClick={() => setIsSummaryExpanded(!isSummaryExpanded)}
                      >
                        <div className="flex items-center">
                          <h2 className="text-[13px] font-medium text-primary-text">Monthly Financial Summary</h2>
                        </div>
                        <div className="flex items-center gap-3">
                          {(isSummaryExpanded && !summaryLoading && (monthlySummary || expenses.filter(e => e.date >= currentMonthStart && e.date < nextMonthStart).length > 0)) && (
                            <button 
                              onClick={(e) => {
                                e.stopPropagation();
                                handleRegenerateSummary();
                              }}
                              disabled={summaryLoading}
                              className="text-xs text-muted-text hover:text-primary-text transition-colors flex items-center gap-1 bg-background/50 px-2 py-1 rounded border border-white/10 hover:border-muted-text"
                              title="Regenerate Summary"
                            >
                              <svg xmlns="http://www.w3.org/2000/svg" className="h-3 w-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                              </svg>
                              Refresh
                            </button>
                          )}
                          <svg xmlns="http://www.w3.org/2000/svg" className={`h-4 w-4 text-muted-text transition-transform duration-300 ${isSummaryExpanded ? 'rotate-180' : ''}`} fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                          </svg>
                        </div>
                      </div>
                      
                      {isSummaryExpanded && (
                        <div className="mt-4 pt-4 border-t border-white/10">
                          {summaryLoading ? (
                            <div className="flex items-center gap-3 text-muted-text">
                              <div className="w-4 h-4 border-2 border-primary-accent border-t-transparent rounded-full animate-spin"></div>
                              <span className="text-sm">Analyzing this month's spending...</span>
                            </div>
                          ) : monthlySummary ? (
                            <ul className="text-[13px] text-primary-text leading-relaxed space-y-2 list-disc list-inside">
                              {(() => {
                                try {
                                  const parsed = JSON.parse(monthlySummary);
                                  if (Array.isArray(parsed)) {
                                    return parsed.map((bullet: string, idx: number) => (
                                      <li key={idx} className="pl-1">{bullet}</li>
                                    ));
                                  }
                                  return <li className="pl-1">{monthlySummary}</li>;
                                } catch (e) {
                                  return <li className="pl-1">{monthlySummary}</li>;
                                }
                              })()}
                            </ul>
                          ) : (
                            <p className="text-[13px] text-muted-text italic">No expenses yet this month — add some to see your summary.</p>
                          )}
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Budgets Section */}
                  {budgets.length > 0 && (
                    <div className="flex flex-col gap-3">
                      <h2 className="text-xs font-medium text-muted-text uppercase tracking-wider pl-1">Budgets</h2>
                      <div className="glass-panel-modal rounded-[24px] border border-white/10 shadow-[0_8px_32px_rgba(0,0,0,0.3)] p-5 flex flex-col gap-5">
                        {budgets.map(budget => {
                          const cat = budget.category;
                          const spent = currentMonthTotals[cat] || 0;
                          const budgetPercent = Math.min((spent / budget.monthly_limit) * 100, 100);
                          let barColor = 'bg-muted-text'; // 0-74%
                          if (spent / budget.monthly_limit >= 1) barColor = 'bg-red-500'; // 100%+
                          else if (spent / budget.monthly_limit >= 0.9) barColor = 'bg-orange-500'; // 90-99%
                          else if (spent / budget.monthly_limit >= 0.75) barColor = 'bg-amber-500'; // 75-89%
                          
                          return (
                            <div key={cat} className="flex flex-col gap-1.5">
                              <div className="flex justify-between text-sm">
                                <span className="text-primary-text">{cat}</span>
                                <span className="text-[11px] text-muted-text uppercase tracking-wider self-end mb-[2px]">
                                  {activeSymbol}{spent.toFixed(2)} / {activeSymbol}{budget.monthly_limit.toFixed(2)}
                                </span>
                              </div>
                              <div className="w-full h-1.5 bg-background rounded-full overflow-hidden">
                                <div 
                                  className={`h-full ${barColor} rounded-full transition-all duration-1000`} 
                                  style={{ width: `${budgetPercent}%` }}
                                />
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  )}

                  {/* Breakdown Section */}
                  <div className="flex flex-col gap-3">
                    <h2 className="text-xs font-medium text-muted-text uppercase tracking-wider pl-1">Breakdown</h2>
                    <div className="glass-panel-modal rounded-[24px] border border-white/10 shadow-[0_8px_32px_rgba(0,0,0,0.3)] p-5 flex flex-col gap-5">
                      {Object.entries(categoryTotals).sort((a, b) => b[1] - a[1]).map(([cat, amount]) => {
                        const percent = totalSpent > 0 ? (amount / totalSpent) * 100 : 0;
                        return (
                          <div key={cat} className="flex flex-col gap-1.5">
                            <div className="flex justify-between text-sm">
                              <span className="text-primary-text">{cat}</span>
                              <span className="font-medium text-primary-text">{activeSymbol}{amount.toFixed(2)}</span>
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

      {/* Budget Modal */}
      {isBudgetModalOpen && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-[#1A1714] border border-hairline rounded-2xl p-6 w-full max-w-md shadow-2xl relative max-h-[90vh] flex flex-col">
            <h2 className="text-xl font-serif italic font-bold text-primary-text mb-4">Set Monthly Budgets</h2>
            <div className="overflow-y-auto flex-1 pr-2 space-y-4 custom-scrollbar">
              {allKnownCategories.map(cat => (
                <div key={cat} className="flex items-center justify-between gap-4">
                  <span className="text-sm text-primary-text truncate">{cat}</span>
                  <div className="relative w-32 flex-shrink-0">
                    <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-text text-sm">{activeSymbol}</span>
                    <input 
                      type="number"
                      placeholder="No limit"
                      value={budgetForm[cat] || ''}
                      onChange={(e) => setBudgetForm(prev => ({...prev, [cat]: e.target.value}))}
                      className="w-full bg-background border border-hairline rounded-xl pl-7 pr-3 py-2 text-sm text-primary-text focus:outline-none focus:border-primary-accent"
                    />
                  </div>
                </div>
              ))}
            </div>
            <div className="mt-6 flex justify-end gap-3 pt-4 border-t border-hairline">
              <button onClick={() => setIsBudgetModalOpen(false)} className="px-4 py-2 text-sm text-muted-text hover:text-primary-text transition-colors">Cancel</button>
              <button onClick={handleSaveBudgets} className="px-4 py-2 text-sm bg-primary-accent text-primary-text rounded-xl font-medium hover:brightness-110 shadow-[0_4px_14px_0_rgba(255,92,56,0.39)]">Save Budgets</button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
}
