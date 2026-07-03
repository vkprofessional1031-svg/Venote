'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { supabase } from '@/lib/supabase';
import TaskView from '@/components/TaskView';
import NoteView from '@/components/NoteView';
import TableView from '@/components/TableView';

interface Entry {
  id: string;
  createdAt: number;
  results: any[];
}

export default function Home() {
  const [entries, setEntries] = useState<Entry[]>([]);
  const [activeEntryId, setActiveEntryId] = useState<string | null>(null);
  
  const [inputText, setInputText] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [searchQuery, setSearchQuery] = useState('');
  const [editingEntryId, setEditingEntryId] = useState<string | null>(null);
  const [editingTitle, setEditingTitle] = useState('');

  const [entriesLoading, setEntriesLoading] = useState(true);
  const [session, setSession] = useState<any>(null);
  const [authLoading, setAuthLoading] = useState(true);
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const router = useRouter();

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
      setAuthLoading(false);
      if (!session) {
        router.push('/login');
      }
    });

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      setSession(session);
      setAuthLoading(false);
      if (!session) {
        router.push('/login');
      }
    });

    return () => subscription.unsubscribe();
  }, [router]);

  // Load from Supabase on mount/auth change
  useEffect(() => {
    if (!session?.user?.id) return;
    
    const fetchEntries = async () => {
      setEntriesLoading(true);
      try {
        const { data, error } = await supabase
          .from('entries')
          .select('*')
          .eq('user_id', session.user.id)
          .order('created_at', { ascending: false });
          
        if (error) throw error;
        
        if (data) {
          const formattedEntries = data.map(row => ({
            id: row.id,
            createdAt: new Date(row.created_at).getTime(),
            results: row.results
          }));
          setEntries(formattedEntries);
        }
      } catch (err) {
        console.error('Failed to load entries from Supabase', err);
      } finally {
        setEntriesLoading(false);
      }
    };
    
    fetchEntries();
  }, [session?.user?.id]);

  const handleStructureIt = async () => {
    if (!inputText.trim()) return;
    
    setLoading(true);
    setError(null);

    try {
      const response = await fetch('/api/structure', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text: inputText }),
      });

      const data = await response.json();

      if (!response.ok) {
        if (data.error === 'rate_limit') {
          throw new Error('RATE_LIMIT');
        }
        throw new Error(data.error || 'Failed to structure text');
      }

      const structuredResults = data.results || [data];
      
      const { data: insertedData, error: insertError } = await supabase
        .from('entries')
        .insert({
          user_id: session.user.id,
          results: structuredResults
        })
        .select()
        .single();
        
      if (insertError) throw insertError;

      const newEntry: Entry = {
        id: insertedData.id,
        createdAt: new Date(insertedData.created_at).getTime(),
        results: insertedData.results,
      };

      setEntries([newEntry, ...entries]);
      setActiveEntryId(newEntry.id);
      setInputText('');
      setSearchQuery('');
    } catch (err: any) {
      console.error('Structuring error:', err);
      if (err.message === 'RATE_LIMIT') {
        setError("You've hit the AI service's usage limit — please wait a minute and try again");
      } else {
        setError("Something went wrong — try rephrasing or try again.");
      }
    } finally {
      setLoading(false);
    }
  };

  const handleToggle = (resultIndex: number, taskIndex: number) => {
    if (!activeEntryId) return;
    
    const entryIndex = entries.findIndex(e => e.id === activeEntryId);
    if (entryIndex === -1) return;

    const entry = entries[entryIndex];
    // Deep clone to avoid mutating React state directly
    const updatedResults = JSON.parse(JSON.stringify(entry.results));
    const updatedResult = updatedResults[resultIndex];

    if (updatedResult.type === 'tasks') {
      updatedResult.items[taskIndex].done = !updatedResult.items[taskIndex].done;
    } else if (updatedResult.type === 'note' && updatedResult.embeddedTasks) {
      updatedResult.embeddedTasks[taskIndex].done = !updatedResult.embeddedTasks[taskIndex].done;
    }

    const newEntries = [...entries];
    newEntries[entryIndex] = { ...entry, results: updatedResults };
    setEntries(newEntries);
    
    // Background update
    supabase.from('entries').update({
      results: updatedResults,
      updated_at: new Date().toISOString()
    }).eq('id', entry.id).then(({error}) => {
      if (error) console.error('Failed to update toggle state', error);
    });
  };

  const handleDelete = (e: React.MouseEvent, id: string) => {
    e.stopPropagation();
    if (confirm('Delete this entry?')) {
      const newEntries = entries.filter((entry) => entry.id !== id);
      setEntries(newEntries);
      if (activeEntryId === id) {
        setActiveEntryId(null);
      }
      
      // Background delete
      supabase.from('entries').delete().eq('id', id).then(({error}) => {
        if (error) console.error('Failed to delete entry', error);
      });
    }
  };

  const startRename = (e: React.MouseEvent, id: string, currentTitle: string) => {
    e.stopPropagation();
    setEditingEntryId(id);
    setEditingTitle(currentTitle || 'Untitled');
  };

  const saveRename = (id: string) => {
    if (!editingTitle.trim()) {
      setEditingEntryId(null);
      return;
    }
    
    const entryToUpdate = entries.find(e => e.id === id);
    if (!entryToUpdate) return;
    
    const updatedResults = JSON.parse(JSON.stringify(entryToUpdate.results));
    if (updatedResults.length > 0) {
      updatedResults[0].title = editingTitle.trim();
    }

    const newEntries = entries.map((entry) => {
      if (entry.id === id) {
        return { ...entry, results: updatedResults };
      }
      return entry;
    });
    setEntries(newEntries);
    setEditingEntryId(null);
    
    // Background update
    supabase.from('entries').update({
      results: updatedResults,
      updated_at: new Date().toISOString()
    }).eq('id', id).then(({error}) => {
      if (error) console.error('Failed to update title', error);
    });
  };

  const handleRenameKeyDown = (e: React.KeyboardEvent, id: string) => {
    if (e.key === 'Enter') {
      e.stopPropagation();
      e.preventDefault();
      saveRename(id);
    } else if (e.key === 'Escape') {
      e.stopPropagation();
      setEditingEntryId(null);
    }
  };

  const handleLogOut = async () => {
    await supabase.auth.signOut();
    router.push('/login');
  };

  const activeEntry = entries.find(e => e.id === activeEntryId);
  
  const filteredEntries = entries.filter(entry => {
    const title = entry.results?.[0]?.title || 'Untitled';
    return title.toLowerCase().includes(searchQuery.toLowerCase());
  });

  const getBadgeStyle = (type: string) => {
    switch (type) {
      case 'tasks':
        return 'bg-primary-accent/10 text-primary-accent';
      case 'note':
        return 'bg-tertiary-accent/10 text-tertiary-accent';
      case 'table':
        return 'bg-secondary-accent/10 text-secondary-accent';
      default:
        return 'bg-muted-text/10 text-muted-text';
    }
  };

  // Helper to format date like "Jun 25" or "Today" or "Yesterday"
  const formatDate = (ts: number) => {
    const d = new Date(ts);
    const now = new Date();
    const isToday = d.getDate() === now.getDate() && d.getMonth() === now.getMonth() && d.getFullYear() === now.getFullYear();
    const yesterday = new Date(now);
    yesterday.setDate(now.getDate() - 1);
    const isYesterday = d.getDate() === yesterday.getDate() && d.getMonth() === yesterday.getMonth() && d.getFullYear() === yesterday.getFullYear();

    if (isToday) return 'Today';
    if (isYesterday) return 'Yesterday';
    
    return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
  };

  const getSnippet = (entry: any) => {
    const res = entry.results?.[0];
    if (!res) return '';
    if (res.type === 'note') {
      return res.body ? res.body.substring(0, 50) + '...' : 'No content';
    } else if (res.type === 'tasks') {
      const total = res.items?.length || 0;
      const done = res.items?.filter((i: any) => i.done).length || 0;
      return `${total} items · ${done} completed`;
    } else if (res.type === 'table') {
      return res.columns?.join(' · ') || 'Table data';
    }
    return '';
  };

  if (authLoading) {
    return (
      <div className="min-h-screen bg-background text-primary-text flex items-center justify-center font-sans">
        <svg className="animate-spin h-8 w-8 text-primary-accent" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
        </svg>
      </div>
    );
  }

  if (!session) {
    return null;
  }

  const displayName = session?.user?.user_metadata?.name || session?.user?.email || '';
  const initial = displayName ? displayName.charAt(0).toUpperCase() : '?';

  return (
    <div className="min-h-screen bg-background text-primary-text flex font-sans relative">
      {/* Mobile Drawer Backdrop */}
      {isMobileMenuOpen && (
        <div 
          className="fixed inset-0 bg-black/60 backdrop-blur-sm z-40 md:hidden"
          onClick={() => setIsMobileMenuOpen(false)}
        />
      )}

      {/* Sidebar */}
      <aside className={`fixed top-0 left-0 z-50 transform transition-transform duration-300 md:relative md:translate-x-0 w-[272px] bg-sidebar border-r border-hairline flex flex-col h-[100dvh] md:h-screen md:sticky md:top-0 shrink-0 ${isMobileMenuOpen ? 'translate-x-0' : '-translate-x-full'}`}>
        <div className="p-4 md:p-6 pb-4 space-y-6">
          {/* Logo */}
          <div className="flex items-center gap-3">
            <svg width="32" height="32" viewBox="0 0 32 32" fill="none" xmlns="http://www.w3.org/2000/svg">
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
            <span className="font-serif italic font-bold text-[32px] tracking-tight leading-none pt-1 text-[#F5EDD9]">Venote</span>
          </div>

          <button
            onClick={() => {
              setActiveEntryId(null);
              setInputText('');
              setError(null);
              setIsMobileMenuOpen(false);
            }}
            className="w-full flex items-center justify-center gap-2 px-4 py-3 bg-primary-accent text-primary-text font-medium rounded-xl hover:brightness-110 transition-all shadow-[0_4px_14px_0_rgba(255,92,56,0.39)]"
          >
            <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" viewBox="0 0 20 20" fill="currentColor">
              <path fillRule="evenodd" d="M10 3a1 1 0 011 1v5h5a1 1 0 110 2h-5v5a1 1 0 11-2 0v-5H4a1 1 0 110-2h5V4a1 1 0 011-1z" clipRule="evenodd" />
            </svg>
            New note
          </button>

          <div className="relative">
            <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 absolute left-3.5 top-3 text-muted-text" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
            </svg>
            <input
              type="text"
              placeholder="Search your notes..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-10 pr-4 py-2.5 bg-background border border-hairline rounded-xl text-sm focus:outline-none focus:border-muted-text transition-all placeholder:text-muted-text text-primary-text"
            />
          </div>
        </div>
        
        <div className="px-6 pb-2">
          <span className="text-[10px] font-mono tracking-[0.2em] text-muted-text uppercase">Recent</span>
        </div>

        <div className="flex-1 overflow-y-auto px-4 pb-4 space-y-1 custom-scrollbar">
          {entriesLoading ? (
            <div className="flex justify-center p-4">
              <svg className="animate-spin h-5 w-5 text-muted-text" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
              </svg>
            </div>
          ) : entries.length === 0 ? (
            <p className="text-sm text-muted-text text-center italic mt-4">
              No entries yet — create your first one.
            </p>
          ) : filteredEntries.length === 0 ? (
            <p className="text-sm text-muted-text text-center italic mt-4">
              No entries found.
            </p>
          ) : (
            filteredEntries.map((entry) => (
              <div
                key={entry.id}
                onClick={() => {
                  if (editingEntryId !== entry.id) {
                    setActiveEntryId(entry.id);
                    setIsMobileMenuOpen(false);
                  }
                }}
                className={`group relative w-full text-left p-3 rounded-xl transition-all cursor-pointer border-l-2 ${
                  activeEntryId === entry.id
                    ? 'bg-primary-accent/5 border-primary-accent'
                    : 'hover:bg-card border-transparent'
                }`}
              >
                <div className="flex items-start justify-between mb-2">
                  <div className="flex flex-wrap gap-1.5">
                    {entry.results?.map((res: any, idx: number) => (
                      <span key={idx} className={`font-mono text-[10px] tracking-widest uppercase px-1.5 py-0.5 rounded-sm flex items-center gap-1 ${getBadgeStyle(res.type)}`}>
                        {res.type === 'note' && (
                          <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" /></svg>
                        )}
                        {res.type === 'tasks' && (
                          <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9l2 2 4-4" /></svg>
                        )}
                        {res.type === 'table' && (
                          <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 10h18M3 14h18m-9-4v8m-7 0h14a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z" /></svg>
                        )}
                        {res.type === 'tasks' ? 'TASK' : res.type?.toUpperCase() || 'UNKNOWN'}
                      </span>
                    ))}
                  </div>
                  <span className="font-mono text-muted-text text-[10px] tracking-wide shrink-0 ml-2 mt-0.5">
                    {formatDate(entry.createdAt)}
                  </span>
                </div>

                <div className="relative">
                  {editingEntryId === entry.id ? (
                    <input
                      type="text"
                      autoFocus
                      value={editingTitle}
                      onChange={(e) => setEditingTitle(e.target.value)}
                      onKeyDown={(e) => handleRenameKeyDown(e, entry.id)}
                      onBlur={() => saveRename(entry.id)}
                      onClick={(e) => e.stopPropagation()}
                      className="w-full font-serif italic font-bold text-lg text-primary-text bg-background border border-hairline rounded px-2 py-1 outline-none focus:border-primary-accent"
                    />
                  ) : (
                    <h3 className="font-serif italic font-bold text-lg text-primary-text truncate tracking-tight pr-[96px] md:pr-6">
                      {entry.results?.[0]?.title || 'Untitled'}
                    </h3>
                  )}

                  {/* Actions (Always visible on mobile, hover on desktop) */}
                  {editingEntryId !== entry.id && (
                    <div className="absolute right-0 top-0 bottom-0 flex items-center gap-1 md:gap-1 opacity-100 md:opacity-0 md:group-hover:opacity-100 transition-opacity md:bg-gradient-to-l md:from-[#1A1714] md:group-hover:from-card pl-2">
                      <button
                        onClick={(e) => startRename(e, entry.id, entry.results?.[0]?.title)}
                        className="p-3 md:p-1 text-muted-text hover:text-primary-text rounded transition-colors"
                        title="Rename"
                      >
                        <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 md:h-3.5 md:w-3.5" viewBox="0 0 20 20" fill="currentColor">
                          <path d="M13.586 3.586a2 2 0 112.828 2.828l-.793.793-2.828-2.828.793-.793zM11.379 5.793L3 14.172V17h2.828l8.38-8.379-2.83-2.828z" />
                        </svg>
                      </button>
                      <button
                        onClick={(e) => handleDelete(e, entry.id)}
                        className="p-3 md:p-1 text-muted-text hover:text-red-400 rounded transition-colors"
                        title="Delete"
                      >
                        <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 md:h-3.5 md:w-3.5" viewBox="0 0 20 20" fill="currentColor">
                          <path fillRule="evenodd" d="M9 2a1 1 0 00-.894.553L7.382 4H4a1 1 0 000 2v10a2 2 0 002 2h8a2 2 0 002-2V6a1 1 0 100-2h-3.382l-.724-1.447A1 1 0 0011 2H9zM7 8a1 1 0 012 0v6a1 1 0 11-2 0V8zm5-1a1 1 0 00-1 1v6a1 1 0 102 0V8a1 1 0 00-1-1z" clipRule="evenodd" />
                        </svg>
                      </button>
                    </div>
                  )}
                </div>
                
                {editingEntryId !== entry.id && (
                  <p className="text-sm text-muted-text truncate mt-1 tracking-wide">
                    {getSnippet(entry)}
                  </p>
                )}
              </div>
            ))
          )}
        </div>

        {/* User Profile / Logout */}
        <div 
          className="p-4 border-t border-hairline mt-auto shrink-0 bg-sidebar"
          style={{ paddingBottom: 'max(1rem, env(safe-area-inset-bottom))' }}
        >
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2 overflow-hidden">
              <div className="w-8 h-8 rounded-full bg-primary-accent/20 text-primary-accent flex items-center justify-center shrink-0 font-bold text-sm">
                {initial}
              </div>
              <span className="text-sm text-primary-text font-medium truncate pr-2">
                {displayName}
              </span>
            </div>
            <button
              onClick={handleLogOut}
              className="p-1.5 text-muted-text hover:text-red-400 hover:bg-red-400/10 rounded-lg transition-colors shrink-0"
              title="Log out"
            >
              <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
              </svg>
            </button>
          </div>
        </div>
      </aside>

      {/* Main Content */}
      <main className="flex-1 overflow-y-auto flex flex-col w-full min-w-0">
        
        {/* Mobile Header */}
        <div className="md:hidden flex items-center justify-between p-4 border-b border-hairline bg-background sticky top-0 z-30">
          <div className="flex items-center gap-3">
            <button 
              onClick={() => setIsMobileMenuOpen(true)}
              className="p-2 -ml-2 text-primary-text rounded-lg hover:bg-card transition-colors"
            >
              <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
              </svg>
            </button>
            <div className="flex items-center gap-2">
              <svg width="24" height="24" viewBox="0 0 32 32" fill="none" xmlns="http://www.w3.org/2000/svg">
                <rect width="32" height="32" rx="8" fill="url(#logo-grad-mobile)"/>
                <defs>
                  <linearGradient id="logo-grad-mobile" x1="0" y1="0" x2="32" y2="32" gradientUnits="userSpaceOnUse">
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
              <span className="font-serif italic font-bold text-2xl tracking-tight leading-none text-[#F5EDD9] pt-1">Venote</span>
            </div>
          </div>
        </div>

        <div className="flex-1 flex flex-col items-center">
          {!activeEntry ? (
            <div className="w-full max-w-[800px] px-4 py-8 pb-32 md:px-8 md:py-20 flex flex-col items-center justify-center min-h-[80vh] md:min-h-screen">
              <div className="flex flex-col items-center mb-8 md:mb-12 text-center w-full">
                <h1 className="font-serif italic font-bold text-4xl md:text-6xl lg:text-[5.5rem] tracking-tight leading-[1.1] mb-4 md:mb-6 flex flex-col items-center">
                  <span className="text-primary-text">What's on your</span>
                  <span className="text-primary-accent mt-1">mind?</span>
                </h1>
              
                <p className="text-lg md:text-xl text-muted-text font-medium max-w-2xl mx-auto">
                  Dump anything here — I'll turn it into notes, tasks, and tables.
                </p>
              </div>

              <div className="w-full max-w-3xl relative">
                <div className="fixed bottom-0 left-0 right-0 p-4 bg-background/80 backdrop-blur-xl border-t border-hairline z-20 md:static md:p-0 md:bg-transparent md:backdrop-blur-none md:border-none md:z-auto">
                  <div className="bg-card border border-hairline rounded-[24px] md:rounded-full shadow-2xl relative flex flex-col md:flex-row items-stretch md:items-center p-2 md:p-2 transition-all duration-300 ring-1 ring-white/5 focus-within:ring-primary-accent/30 focus-within:border-primary-accent/50 gap-2 md:gap-0 max-w-3xl mx-auto">
                    <input
                      type="text"
                      className="flex-1 bg-transparent outline-none text-primary-text text-base md:text-lg placeholder:text-muted-text font-sans px-4 py-3 md:pl-6 md:pr-4"
                  placeholder="Paste a brain dump, a transcript, a raw list of ideas, a URL, or a voice note..."
                  value={inputText}
                  onChange={(e) => setInputText(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' && !loading && inputText.trim()) {
                      handleStructureIt();
                    }
                  }}
                  disabled={loading}
                />
                
                <div className="shrink-0 md:pr-1 flex">
                  <button
                    onClick={handleStructureIt}
                    disabled={loading || !inputText.trim()}
                    className={`w-full md:w-auto px-6 py-3.5 md:py-3 bg-[#3A221C] text-primary-accent font-medium rounded-[24px] md:rounded-full transition-all flex items-center justify-center gap-2 border border-primary-accent/20 hover:bg-primary-accent hover:text-primary-text ${
                      (!inputText.trim() || loading) ? 'opacity-40 cursor-not-allowed' : 'opacity-100 hover:shadow-[0_0_15px_rgba(255,92,56,0.3)]'
                    }`}
                  >
                    {loading ? (
                      <svg className="animate-spin h-5 w-5" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                      </svg>
                    ) : (
                      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                        <path d="M12 2L14.5 9.5L22 12L14.5 14.5L12 22L9.5 14.5L2 12L9.5 9.5L12 2Z" fill="currentColor"/>
                      </svg>
                    )}
                    {loading ? 'Organizing...' : 'Organize'}
                  </button>
                </div>
              </div>
              </div>
              
              {error && (
                <div className="absolute bottom-[100%] left-0 right-0 mb-4 p-4 text-sm text-red-300 bg-red-950/40 rounded-xl border border-red-900/50 flex items-center gap-2 backdrop-blur-md z-10 mx-4 md:mx-0">
                  <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 shrink-0" viewBox="0 0 20 20" fill="currentColor">
                    <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7 4a1 1 0 11-2 0 1 1 0 012 0zm-1-9a1 1 0 00-1 1v4a1 1 0 102 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
                  </svg>
                  {error}
                </div>
              )}
            </div>
          </div>
        ) : (
          <div className="w-full max-w-4xl px-4 md:px-8 py-8 md:py-16 transition-all space-y-6 md:space-y-8">
            {activeEntry.results?.map((res: any, idx: number) => {
              if (res.type === 'tasks') {
                return (
                  <TaskView 
                    key={idx}
                    title={res.title} 
                    items={res.items} 
                    onToggle={(taskIdx) => handleToggle(idx, taskIdx)}
                  />
                );
              }
              
              if (res.type === 'note') {
                return (
                  <NoteView 
                    key={idx}
                    title={res.title} 
                    body={res.body} 
                    embeddedTasks={res.embeddedTasks} 
                    onToggle={(taskIdx) => handleToggle(idx, taskIdx)}
                  />
                );
              }
              
              if (res.type === 'table') {
                return (
                  <TableView 
                    key={idx}
                    title={res.title} 
                    columns={res.columns} 
                    rows={res.rows} 
                  />
                );
              }

              return (
                <div key={idx} className="bg-card p-8 rounded-2xl border border-hairline text-center">
                  <p className="text-muted-text">Received an unknown structure format from the AI.</p>
                </div>
              );
            })}
          </div>
        )}
        </div>
      </main>
    </div>
  );
}
