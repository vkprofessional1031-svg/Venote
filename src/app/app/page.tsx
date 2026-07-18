'use client';

import { useState, useEffect, useRef, startTransition, type FormEvent } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { supabase } from '@/lib/supabase';
import TaskView from '@/components/TaskView';
import NoteView from '@/components/NoteView';
import TableView from '@/components/TableView';
import TagManager from '@/components/TagManager';
import RoadmapView from '@/components/RoadmapView';
import { useToast } from '@/components/ToastProvider';

import EntriesList, { Entry, SortOption } from '@/components/EntriesList';

export default function Home() {
  const [entries, setEntries] = useState<Entry[]>([]);
  const [activeEntryId, setActiveEntryId] = useState<string | null>(null);
  
  const [inputText, setInputText] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [searchQuery, setSearchQuery] = useState('');
  const [sortOption, setSortOption] = useState<SortOption>('newest');
  const [editingEntryId, setEditingEntryId] = useState<string | null>(null);
  const [editingTitle, setEditingTitle] = useState('');

  const [entriesLoading, setEntriesLoading] = useState(true);
  const [session, setSession] = useState<any>(null);
  const [authLoading, setAuthLoading] = useState(true);
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [saveState, setSaveState] = useState<'idle' | 'saving' | 'saved'>('idle');
  const [activeTagFilter, setActiveTagFilter] = useState<string | null>(null);
  const [showArchived, setShowArchived] = useState(false);
  const router = useRouter();
  const { showToast } = useToast();
  const debounceTimerRef = useRef<NodeJS.Timeout | null>(null);
  const organizeInputRef = useRef<HTMLInputElement>(null);

  const [speechSupported, setSpeechSupported] = useState(false);
  const [isListening, setIsListening] = useState(false);
  const recognitionRef = useRef<any>(null);

  useEffect(() => {
    if (typeof window !== 'undefined') {
      const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
      if (SpeechRecognition) {
        setSpeechSupported(true);
        const recognition = new SpeechRecognition();
        recognition.continuous = false; // Stop naturally on pause
        recognition.interimResults = false; // Wait for final result

        recognition.onresult = (event: any) => {
          const transcript = event.results[0][0].transcript;
          setInputText(prev => prev + (prev && !prev.endsWith(' ') ? ' ' : '') + transcript);
        };

        recognition.onerror = (event: any) => {
          console.error('Speech recognition error:', event.error);
          setIsListening(false);
          if (event.error === 'not-allowed' || event.error === 'service-not-allowed') {
            setError('Microphone permission denied.');
          } else if (event.error !== 'no-speech') {
            setError(`Microphone error: ${event.error}`);
          }
          setTimeout(() => setError(null), 3000);
        };

        recognition.onend = () => {
          setIsListening(false);
        };

        recognitionRef.current = recognition;
      }
    }
  }, []);

  const toggleListening = () => {
    if (isListening) {
      recognitionRef.current?.stop();
      setIsListening(false);
    } else {
      setError(null);
      try {
        recognitionRef.current?.start();
        setIsListening(true);
      } catch (err) {
        console.error('Failed to start listening', err);
      }
    }
  };

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
    console.log('[Auth] Check before fetch: authLoading =', authLoading, 'session =', session?.user?.id ? 'exists' : 'null');
    
    if (authLoading || !session?.user?.id) {
      console.log('[Auth] Not fetching entries yet (waiting for session resolution).');
      return;
    }
    
    const fetchEntries = async () => {
      console.log(`[Fetch] Starting entries fetch for user_id: ${session.user.id}`);
      setEntriesLoading(true);
      try {
        const { data, error } = await supabase
          .from('entries')
          .select('*')
          .eq('user_id', session.user.id)
          .order('pinned', { ascending: false, nullsFirst: false })
          .order('created_at', { ascending: false });
          
        if (error) {
          console.error('[Fetch] Supabase error fetching entries:', error);
          throw error;
        }
        
        console.log(`[Fetch] Query returned ${data?.length || 0} rows.`);
        
        if (data) {
          const formattedEntries = data.map(row => ({
            id: row.id,
            createdAt: new Date(row.created_at).getTime(),
            updatedAt: row.updated_at ? new Date(row.updated_at).getTime() : new Date(row.created_at).getTime(),
            results: row.results,
            pinned: row.pinned || false,
            tags: row.tags || [],
            isArchived: row.is_archived || false,
            imageUrls: row.image_urls || []
          }));
          setEntries(formattedEntries);
        }
      } catch (err) {
        console.error('[Fetch] Failed to load entries from Supabase:', err);
      } finally {
        setEntriesLoading(false);
      }
    };
    
    fetchEntries();
  }, [session?.user?.id, authLoading]);

  const handleStructureIt = async () => {
    console.log("ORGANIZE HANDLER FIRED");
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
        updatedAt: insertedData.updated_at ? new Date(insertedData.updated_at).getTime() : new Date(insertedData.created_at).getTime(),
        results: insertedData.results,
        tags: []
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

  const handleStructureSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    void handleStructureIt();
  };

  const handleNewNote = () => {
    setIsMobileMenuOpen(false);
    setActiveEntryId(null);
    setInputText('');
    // Use timeout to ensure the empty state is rendered before focusing
    setTimeout(() => {
      organizeInputRef.current?.focus();
    }, 0);
  };

  const handleUpdateResult = (resultIndex: number, newResultData: any) => {
    if (!activeEntryId) return;

    setSaveState('saving');
    
    const entryIndex = entries.findIndex(e => e.id === activeEntryId);
    if (entryIndex === -1) return;

    const entry = entries[entryIndex];
    const updatedResults = [...entry.results];
    updatedResults[resultIndex] = newResultData;

    const newEntries = [...entries];
    newEntries[entryIndex] = { ...entry, results: updatedResults, updatedAt: Date.now() };
    setEntries(newEntries);

    if (debounceTimerRef.current) clearTimeout(debounceTimerRef.current);
    debounceTimerRef.current = setTimeout(() => {
      supabase.from('entries').update({
        results: updatedResults,
        updated_at: new Date().toISOString()
      }).eq('id', entry.id).then(({error}) => {
        if (error) {
          console.error('Failed to update entry content', error);
          setSaveState('idle');
          showToast('Could not save note, try again', 'error');
        } else {
          setSaveState('saved');
          setTimeout(() => setSaveState('idle'), 2000);
          showToast('Note saved');
        }
      });
    }, 800);
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
    newEntries[entryIndex] = { ...entry, results: updatedResults, updatedAt: Date.now() };
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
        if (error) {
          console.error('Failed to delete entry', error);
          showToast('Could not delete note, try again', 'error');
        } else {
          showToast('Note deleted');
        }
      });
    }
  };

  const handleAddTag = (id: string, tag: string) => {
    const entryToUpdate = entries.find(e => e.id === id);
    if (!entryToUpdate) return;
    
    const cleanTag = tag.trim().toLowerCase();
    if (!cleanTag) return;
    
    const currentTags = entryToUpdate.tags || [];
    if (currentTags.includes(cleanTag)) return;
    
    const newTags = [...currentTags, cleanTag];
    const newEntries = entries.map((entry) => {
      if (entry.id === id) {
        return { ...entry, tags: newTags, updatedAt: Date.now() };
      }
      return entry;
    });
    setEntries(newEntries);
    
    supabase.from('entries').update({
      tags: newTags,
      updated_at: new Date().toISOString()
    }).eq('id', id).then(({error}) => {
      if (error) {
        console.error('Failed to add tag', error);
        showToast('Could not add tag, try again', 'error');
      } else {
        showToast('Tag added');
      }
    });
  };

  const handleRemoveTag = (id: string, tag: string) => {
    const entryToUpdate = entries.find(e => e.id === id);
    if (!entryToUpdate) return;
    
    const currentTags = entryToUpdate.tags || [];
    const newTags = currentTags.filter(t => t !== tag);
    
    const newEntries = entries.map((entry) => {
      if (entry.id === id) {
        return { ...entry, tags: newTags, updatedAt: Date.now() };
      }
      return entry;
    });
    setEntries(newEntries);
    
    supabase.from('entries').update({
      tags: newTags,
      updated_at: new Date().toISOString()
    }).eq('id', id).then(({error}) => {
      if (error) {
        console.error('Failed to remove tag', error);
        showToast('Could not remove tag, try again', 'error');
      } else {
        showToast('Tag removed');
      }
    });
  };

  const handleTogglePin = (e: React.MouseEvent, id: string, currentPinned: boolean) => {
    e.stopPropagation();
    const newPinnedState = !currentPinned;
    
    setEntries(entries.map(entry => 
      entry.id === id ? { ...entry, pinned: newPinnedState } : entry
    ));
    
    supabase.from('entries').update({
      pinned: newPinnedState,
      updated_at: new Date().toISOString()
    }).eq('id', id).then(({error}) => {
      if (error) console.error('Failed to update pinned state', error);
    });
  };

  const handleArchiveToggle = (e: React.MouseEvent, id: string, currentArchived: boolean) => {
    e.stopPropagation();
    const newArchivedState = !currentArchived;
    
    setEntries(entries.map(entry => 
      entry.id === id ? { ...entry, isArchived: newArchivedState } : entry
    ));
    
    supabase.from('entries').update({
      is_archived: newArchivedState,
      updated_at: new Date().toISOString()
    }).eq('id', id).then(({error}) => {
      if (error) console.error('Failed to update archive state', error);
      else {
        showToast(newArchivedState ? 'Entry archived' : 'Entry unarchived');
        if (newArchivedState && activeEntryId === id) {
          setActiveEntryId(null);
        }
      }
    });
  };

  const handleUpdateImages = (id: string, newUrls: string[]) => {
    setEntries(entries.map(entry => 
      entry.id === id ? { ...entry, imageUrls: newUrls } : entry
    ));
    supabase.from('entries').update({
      image_urls: newUrls,
      updated_at: new Date().toISOString()
    }).eq('id', id).then(({error}) => {
      if (error) {
        console.error('Failed to update images', error);
        showToast('Failed to save image attachment', 'error');
      }
    });
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

  const allUniqueTags = Array.from(new Set(entries.flatMap(e => e.tags || []))).sort();
  const activeEntry = entries.find(e => e.id === activeEntryId);

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
      <aside className={`fixed top-0 left-0 z-50 transform transition-transform duration-300 md:relative md:translate-x-0 w-[272px] bg-sidebar border-r border-hairline flex flex-col h-[100dvh] md:h-screen md:sticky md:top-0 shrink-0 ${isMobileMenuOpen ? 'translate-x-0 pointer-events-auto' : '-translate-x-full pointer-events-none md:pointer-events-auto'}`}>
        <div className="p-4 md:p-5 pb-3 space-y-4">
          {/* Logo */}
          <Link href="/app" className="flex items-center gap-3">
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
          </Link>

          <button
            type="button"
            onClick={handleNewNote}
            className="w-full flex items-center justify-center gap-2 px-4 py-3 bg-primary-accent text-primary-text font-medium rounded-xl hover:brightness-110 transition-all shadow-[0_4px_14px_0_rgba(255,92,56,0.39)]"
          >
            <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" viewBox="0 0 20 20" fill="currentColor">
              <path fillRule="evenodd" d="M10 3a1 1 0 011 1v5h5a1 1 0 110 2h-5v5a1 1 0 11-2 0v-5H4a1 1 0 110-2h5V4a1 1 0 011-1z" clipRule="evenodd" />
            </svg>
            New note
          </button>

          <Link
            href="/app/quick-notes"
            className="w-full flex items-center justify-start gap-2 px-4 py-2.5 bg-background/50 text-muted-text hover:text-primary-text font-medium rounded-xl hover:bg-background transition-all border border-transparent hover:border-hairline"
          >
            <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
            </svg>
            Quick Notes
          </Link>

          <div className="flex items-center gap-2">
            <div className="relative flex-1">
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
            <button
              type="button"
              onClick={() => {
                setShowArchived(!showArchived);
                setActiveEntryId(null);
              }}
              title="Archived"
              className={`shrink-0 p-2.5 rounded-xl transition-colors border ${
                showArchived 
                  ? 'bg-primary-text text-background border-primary-text' 
                  : 'bg-background text-muted-text border-hairline hover:border-muted-text hover:text-primary-text'
              }`}
            >
              <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 8h14M5 8a2 2 0 110-4h14a2 2 0 110 4M5 8v10a2 2 0 002 2h10a2 2 0 002-2V8m-9 4h4" />
              </svg>
            </button>
          </div>

          {/* Tags Filter Row */}
          {allUniqueTags.length > 0 && (
            <div className="flex overflow-x-auto gap-2 pb-2 -mx-4 px-4 md:-mx-6 md:px-6 scrollbar-hide snap-x">
              {allUniqueTags.map(tag => (
                <button
                  key={tag}
                  type="button"
                  onClick={() => setActiveTagFilter(activeTagFilter === tag ? null : tag)}
                  className={`shrink-0 snap-start px-2.5 py-1 rounded-full text-[10px] font-mono tracking-wide transition-all border ${
                    activeTagFilter === tag 
                      ? 'bg-primary-text text-background border-primary-text'
                      : 'bg-background text-muted-text border-hairline hover:border-muted-text hover:text-primary-text'
                  }`}
                >
                  #{tag}
                </button>
              ))}
            </div>
          )}

          {/* Sort Dropdown */}
          <div className="flex items-center justify-between pb-3 pt-1">
            <span className="text-[10px] font-mono tracking-wide text-muted-text/50 uppercase">Sort by</span>
            <select
              value={sortOption}
              onChange={(e) => setSortOption(e.target.value as SortOption)}
              className="bg-transparent text-muted-text hover:text-primary-text text-[11px] font-mono uppercase tracking-wide outline-none cursor-pointer border-none text-right appearance-none"
            >
              <option value="newest" className="bg-[#1A1714]">Newest first</option>
              <option value="oldest" className="bg-[#1A1714]">Oldest first</option>
              <option value="az" className="bg-[#1A1714]">A-Z</option>
              <option value="edited" className="bg-[#1A1714]">Recently edited</option>
            </select>
          </div>

        </div>

        <div className="flex-1 overflow-y-auto px-4 pb-4 space-y-1 custom-scrollbar">
          <EntriesList
            entries={entries}
            activeTagFilter={activeTagFilter}
            searchQuery={searchQuery}
            sortOption={sortOption}
            entriesLoading={entriesLoading}
            activeEntryId={activeEntryId}
            editingEntryId={editingEntryId}
            editingTitle={editingTitle}
            setActiveEntryId={(id) => {
              setActiveEntryId(id);
            }}
            setIsMobileMenuOpen={setIsMobileMenuOpen}
            setEditingTitle={setEditingTitle}
            handleRenameKeyDown={handleRenameKeyDown}
            saveRename={saveRename}
            handleTogglePin={handleTogglePin}
            startRename={startRename}
            handleDelete={handleDelete}
            showArchived={showArchived}
            handleArchiveToggle={handleArchiveToggle}
          />
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
              type="button"
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
          <Link href="/app" className="flex items-center gap-3">
            <button 
              type="button"
              onClick={(e) => { e.preventDefault(); setIsMobileMenuOpen(true); }}
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
          </Link>
          {saveState !== 'idle' && (
            <span className="text-xs font-mono text-muted-text/60">
              {saveState === 'saving' ? 'Saving...' : 'Saved'}
            </span>
          )}
        </div>

        <div className="flex-1 flex flex-col items-center">
          {!activeEntry ? (
            <div className="w-full max-w-[800px] px-4 py-8 pb-32 md:px-8 md:py-20 flex flex-col items-center justify-center min-h-[80vh] md:min-h-screen">
                <div className="flex flex-col items-center mb-8 md:mb-12 text-center w-full">
                  <h1 className="font-serif italic font-bold text-4xl md:text-[40px] lg:text-[44px] tracking-tight leading-[1.1] mb-3 flex flex-col items-center">
                    <span className="text-primary-text">What's on your</span>
                    <span className="text-primary-accent mt-1">mind?</span>
                  </h1>
                
                  <p className="text-base md:text-lg text-muted-text font-medium max-w-2xl mx-auto">
                    Dump anything here — I'll turn it into notes, tasks, and tables.
                  </p>
                </div>

                <div className="w-full max-w-3xl relative">
                  <div className="fixed bottom-0 left-0 right-0 p-4 bg-background/80 backdrop-blur-xl border-t border-hairline z-20 md:static md:p-0 md:bg-transparent md:backdrop-blur-none md:border-none md:z-auto">
                    <form onSubmit={handleStructureSubmit} className="bg-card border border-hairline rounded-[24px] md:rounded-full shadow-2xl relative flex flex-col md:flex-row items-stretch md:items-center p-1.5 md:p-1.5 ring-1 ring-white/5 focus-within:ring-primary-accent/30 focus-within:border-primary-accent/50 gap-2 md:gap-0 max-w-3xl mx-auto">
                      <input
                        ref={organizeInputRef}
                        type="text"
                        className="flex-1 bg-transparent outline-none text-primary-text text-base placeholder:text-muted-text font-sans px-4 py-2.5 md:pl-5 md:pr-3"
                        placeholder="Paste a brain dump, a transcript, a raw list of ideas, a URL, or a voice note..."
                        value={inputText}
                        onChange={(e) => setInputText(e.target.value)}
                        disabled={loading}
                      />
                      
                      <div className="shrink-0 md:pr-1 flex items-center gap-1">
                        {speechSupported && (
                          <button
                            type="button"
                            onClick={toggleListening}
                            disabled={loading}
                            className={`p-3 rounded-full transition-all ${
                              isListening
                                ? 'bg-primary-accent/20 text-primary-accent shadow-[0_0_15px_rgba(255,92,56,0.2)] animate-pulse'
                                : 'text-muted-text hover:text-primary-text hover:bg-background/50'
                            }`}
                            title={isListening ? "Stop listening" : "Start voice input"}
                          >
                            <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 11a7 7 0 01-7 7m0 0a7 7 0 01-7-7m7 7v4m0 0H8m4 0h4m-4-8a3 3 0 01-3-3V5a3 3 0 116 0v6a3 3 0 01-3 3z" />
                            </svg>
                          </button>
                        )}
                        <button
                          type="submit"
                          disabled={loading || !inputText.trim()}
                          className={`w-full md:w-auto px-5 py-2.5 md:py-2 bg-[#3A221C] text-primary-accent font-medium rounded-[24px] md:rounded-full transition-all flex items-center justify-center gap-2 border border-primary-accent/20 hover:bg-primary-accent hover:text-primary-text ${
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
                    </form>
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
        ) : (
          <div className="w-full max-w-4xl px-4 md:px-8 py-8 md:py-16 space-y-6 md:space-y-8 relative">
            {activeEntry.results?.map((res: any, idx: number) => {
              const archiveBtnNode = (
                <button
                  type="button"
                  onClick={(e) => handleArchiveToggle(e, activeEntry.id, !!activeEntry.isArchived)}
                  className="p-1.5 text-muted-text hover:text-primary-text hover:bg-white/5 rounded-lg transition-colors"
                  title={activeEntry.isArchived ? "Unarchive" : "Archive"}
                >
                  {activeEntry.isArchived ? (
                    <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 10h10a8 8 0 018 8v2M3 10l6 6m-6-6l6-6" />
                    </svg>
                  ) : (
                    <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" viewBox="0 0 20 20" fill="currentColor">
                      <path d="M4 3a2 2 0 100 4h12a2 2 0 100-4H4z" />
                      <path fillRule="evenodd" d="M3 8h14v7a2 2 0 01-2 2H5a2 2 0 01-2-2V8zm5 3a1 1 0 011-1h2a1 1 0 110 2H9a1 1 0 01-1-1z" clipRule="evenodd" />
                    </svg>
                  )}
                </button>
              );
              const tagsNode = idx === 0 ? (
                <TagManager 
                  entryId={activeEntry.id}
                  tags={activeEntry.tags || []}
                  allUniqueTags={allUniqueTags}
                  onAddTag={handleAddTag}
                  onRemoveTag={handleRemoveTag}
                />
              ) : null;
              if (res.type === 'tasks') {
                return (
                  <TaskView 
                    key={idx}
                    title={res.title} 
                    items={res.items} 
                    headerAddon={tagsNode}
                    saveState={idx === 0 ? saveState : 'idle'}
                    archiveButton={idx === 0 ? archiveBtnNode : undefined}
                    onToggle={(taskIdx) => handleToggle(idx, taskIdx)}
                    onUpdate={(newData) => handleUpdateResult(idx, newData)}
                  />
                );
              }
              
              if (res.type === 'note') {
                return (
                  <NoteView 
                    key={`${activeEntry.createdAt}-${idx}`}
                    title={res.title} 
                    body={res.body} 
                    embeddedTasks={res.embeddedTasks} 
                    headerAddon={tagsNode}
                    saveState={idx === 0 ? saveState : 'idle'}
                    archiveButton={idx === 0 ? archiveBtnNode : undefined}
                    onToggle={(taskIdx) => handleToggle(idx, taskIdx)}
                    onUpdate={(newData) => handleUpdateResult(idx, newData)}
                    imageUrls={activeEntry.imageUrls}
                    onUpdateImages={(newUrls) => handleUpdateImages(activeEntry.id, newUrls)}
                    uploadPathPrefix={`${session?.user?.id}/${activeEntry.id}`}
                  />
                );
              }
              
              if (res.type === 'table') {
                return (
                  <TableView 
                    key={idx}
                    title={res.title} 
                    columns={res.columns || []} 
                    rows={res.rows || []} 
                    archiveButton={idx === 0 ? archiveBtnNode : undefined}
                    onUpdate={(newData) => handleUpdateResult(idx, newData)}
                  />
                );
              }
              
              if (res.type === 'roadmap') {
                return (
                  <RoadmapView
                    key={idx}
                    title={res.title}
                    goal={res.goal}
                    milestones={res.milestones || []}
                    onUpdate={(newData) => handleUpdateResult(idx, newData)}
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
