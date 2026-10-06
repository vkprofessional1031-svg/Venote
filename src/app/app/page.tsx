'use client';

import { useState, useEffect, useRef, startTransition, type FormEvent } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import AppSidebar from '@/components/AppSidebar';
import AppMobileHeader from '@/components/AppMobileHeader';
import { supabase } from '@/lib/supabase';
import TaskView from '@/components/TaskView';
import NoteView from '@/components/NoteView';
import TableView from '@/components/TableView';
import TagManager from '@/components/TagManager';
import RoadmapView from '@/components/RoadmapView';
import { useToast } from '@/components/ToastProvider';
import { TrashList } from '@/components/TrashList';
import { purgeExpiredTrash } from '@/utils/trash';
import { useCallback } from 'react';
import OnboardingTour from '@/components/OnboardingTour';

import EntriesList, { Entry, SortOption } from '@/components/EntriesList';
import { insertWalletItems } from '@/utils/transactions';
import { insertPrepItems } from '@/utils/prep';
import ThreadView, { Turn } from '@/components/ThreadView';
import { readNdjson } from '@/lib/readStream';

export default function Home() {
  const [entries, setEntries] = useState<Entry[]>([]);
  const [activeEntryId, setActiveEntryId] = useState<string | null>(null);
  const [turns, setTurns] = useState<Turn[]>([]);
  const [currentChatEntryId, setCurrentChatEntryId] = useState<string | null>(null);
  
  const [isStreamingAsk, setIsStreamingAsk] = useState(false);
  const askAbortControllerRef = useRef<AbortController | null>(null);
  const pendingAskUpdateRef = useRef<{ id: string, answer: string, sources: any[], statusText: string } | null>(null);
  
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
  const [viewMode, setViewMode] = useState<'normal' | 'archived' | 'trash'>('normal');
  const router = useRouter();
  const { showToast } = useToast();
  const debounceTimerRef = useRef<NodeJS.Timeout | null>(null);
  const organizeInputRef = useRef<HTMLTextAreaElement>(null);

  const [speechSupported, setSpeechSupported] = useState(false);
  const [isListening, setIsListening] = useState(false);
  const recognitionRef = useRef<any>(null);

  const [isMobilePlaceholder, setIsMobilePlaceholder] = useState(false);
  useEffect(() => {
    const handleResize = () => setIsMobilePlaceholder(window.innerWidth < 768);
    handleResize();
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  const [viewportHeight, setViewportHeight] = useState('100dvh');
  useEffect(() => {
    const handleResize = () => {
      if (window.visualViewport) {
        setViewportHeight(`${window.visualViewport.height}px`);
      } else {
        setViewportHeight('100dvh');
      }
    };
    handleResize();
    window.visualViewport?.addEventListener('resize', handleResize);
    return () => window.visualViewport?.removeEventListener('resize', handleResize);
  }, []);

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
      } else {
        purgeExpiredTrash(supabase, session.user.id);
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

  const fetchEntries = useCallback(async () => {
    if (authLoading || !session?.user?.id) return;
    setEntriesLoading(true);
    try {
      const { data, error } = await supabase
        .from('entries')
        .select('*')
        .eq('user_id', session.user.id)
        .is('deleted_at', null)
        .order('pinned', { ascending: false, nullsFirst: false })
        .order('created_at', { ascending: false });
        
      if (error) {
        console.error('[Fetch] Supabase error fetching entries:', error);
        throw error;
      }
      
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
  }, [session?.user?.id, authLoading]);

  // Load from Supabase on mount/auth change
  useEffect(() => {
    fetchEntries();
  }, [fetchEntries]);

  const handleStructureIt = async (overrideDomain?: string, overrideText?: string, existingTurnId?: string) => {
    const textToProcess = overrideText || inputText;
    if (!textToProcess.trim()) return;
    
    setLoading(true);
    setError(null);
    setActiveEntryId(null);
    setInputText('');
    setSearchQuery('');
    if (organizeInputRef.current) {
      organizeInputRef.current.style.height = 'auto';
    }
    setTimeout(() => {
      organizeInputRef.current?.focus();
    }, 0);

    const turnId = existingTurnId || `turn-${Date.now()}`;
    if (!existingTurnId) {
      setTurns(prev => [...prev, { id: turnId, userText: textToProcess, status: 'pending' }]);
    } else {
      setTurns(prev => prev.map(t => t.id === turnId ? { ...t, status: 'pending' } : t));
    }

    try {
      let domain = overrideDomain;
      if (!domain) {
        // Classify domain first
        const routerRes = await fetch('/api/router', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ text: textToProcess }),
        });
        const routerData = await routerRes.json();
        if (!routerRes.ok) throw new Error(routerData.error || 'Failed to route input');
        domain = routerData.domain || 'organize';
      }

      if (domain === 'ask') {
        const { data: { session: authSession } } = await supabase.auth.getSession();
        const token = authSession?.access_token;
        
        let previousMessages: {role: string, content: string}[] = [];
        if (currentChatEntryId) {
           const chatEntry = entries.find(e => e.id === currentChatEntryId);
           if (chatEntry && chatEntry.results[0]?.messages) {
              previousMessages = chatEntry.results[0].messages.slice(-6);
           }
        } else {
           const askTurns = turns.filter(t => t.kind === 'ask' && t.status === 'done');
           const lastAsks = askTurns.slice(-3);
           for (const t of lastAsks) {
              previousMessages.push({ role: 'user', content: t.userText });
              if (t.answer) previousMessages.push({ role: 'assistant', content: t.answer });
           }
        }
        
        // If we are regenerating, the last message in `previousMessages` might be the assistant's old answer.
        // We pop it if it is assistant.
        if (existingTurnId && previousMessages.length > 0 && previousMessages[previousMessages.length - 1].role === 'assistant') {
           previousMessages.pop();
        }
        
        if (previousMessages.length === 0 || previousMessages[previousMessages.length - 1].content !== textToProcess) {
          previousMessages.push({ role: 'user', content: textToProcess });
        }

        const timezone = Intl.DateTimeFormat().resolvedOptions().timeZone;
        const today = new Date().toISOString().split('T')[0];

        setIsStreamingAsk(true);
        const abortController = new AbortController();
        askAbortControllerRef.current = abortController;
        pendingAskUpdateRef.current = { id: turnId, answer: '', sources: [], statusText: '' };
        
        const flushInterval = setInterval(() => {
          if (pendingAskUpdateRef.current) {
            const { id, answer, sources, statusText } = pendingAskUpdateRef.current;
            setTurns(prev => prev.map(t => t.id === id ? { 
              ...t, 
              status: answer || sources.length > 0 ? 'done' : 'pending',
              kind: 'ask', 
              answer, 
              sources,
              statusText,
              isStreaming: true 
            } : t));
          }
        }, 50);

        let finalAnswer = "";
        let finalSources: any[] = [];
        let isStopped = false;

        try {
          const response = await fetch('/api/ask', {
            method: 'POST',
            headers: { 
              'Content-Type': 'application/json',
              'Authorization': `Bearer ${token}`
            },
            body: JSON.stringify({ messages: previousMessages, today, timezone }),
            signal: abortController.signal
          });
          
          if (!response.ok) {
            const data = await response.json().catch(()=>({}));
            throw new Error(data.error || 'Failed to get answer');
          }

          await readNdjson(response, {
            onDelta: (text) => {
              if (pendingAskUpdateRef.current) {
                pendingAskUpdateRef.current.answer += text;
                finalAnswer = pendingAskUpdateRef.current.answer;
              }
            },
            onClear: () => {
              if (pendingAskUpdateRef.current) {
                pendingAskUpdateRef.current.answer = "";
                finalAnswer = "";
              }
            },
            onStatus: (text) => {
              if (pendingAskUpdateRef.current) {
                pendingAskUpdateRef.current.statusText = text;
              }
            },
            onSources: (sources) => {
              if (pendingAskUpdateRef.current) {
                pendingAskUpdateRef.current.sources = sources;
                finalSources = sources;
              }
            },
            onError: (msg) => { throw new Error(msg); }
          }, abortController.signal);
          
        } catch (err: any) {
          if (err.name === 'AbortError' || abortController.signal.aborted) {
            isStopped = true;
            if (pendingAskUpdateRef.current) {
              pendingAskUpdateRef.current.answer += "\n\n*(Stopped)*";
              finalAnswer = pendingAskUpdateRef.current.answer;
            }
          } else {
            throw err;
          }
        } finally {
          clearInterval(flushInterval);
          setIsStreamingAsk(false);
          askAbortControllerRef.current = null;
        }

        setTurns(prev => prev.map(t => t.id === turnId ? { 
          ...t, 
          status: 'done', 
          kind: 'ask', 
          answer: finalAnswer, 
          sources: finalSources,
          statusText: undefined,
          isStreaming: false 
        } : t));

        const updatedMessages = [...previousMessages, { role: 'assistant', content: finalAnswer }];

        if (!currentChatEntryId) {
          const title = textToProcess.substring(0, 40) + (textToProcess.length > 40 ? '...' : '');
          const { data: insertedData, error: insertError } = await supabase
            .from('entries')
            .insert({
              user_id: session!.user.id,
              results: [{ type: 'chat', title, messages: updatedMessages }]
            })
            .select()
            .single();
            
          if (!insertError && insertedData) {
            setCurrentChatEntryId(insertedData.id);
            setEntries(prev => [{
              id: insertedData.id,
              createdAt: new Date(insertedData.created_at).getTime(),
              updatedAt: new Date(insertedData.updated_at).getTime(),
              results: insertedData.results,
              tags: []
            }, ...prev]);
          }
        } else {
           const chatEntry = entries.find(e => e.id === currentChatEntryId);
           if (chatEntry) {
              const newResults = [{ ...chatEntry.results[0], messages: updatedMessages }];
              setEntries(prev => prev.map(e => e.id === currentChatEntryId ? { ...e, results: newResults } : e));
              supabase.from('entries').update({ results: newResults }).eq('id', currentChatEntryId).then();
           }
        }
      } else if (domain === 'wallet') {
        const response = await fetch('/api/structure', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ text: textToProcess, domain: 'wallet', currencySymbol: '$' }),
        });
        const data = await response.json();
        if (!response.ok) throw new Error(data.error || 'Failed to structure text');
        
        const validItems = (data.results || []).filter((r: any) => r.type === 'expense' || r.type === 'income');
        if (validItems.length === 0) throw new Error("Could not detect any expenses or incomes.");
        
        const processedItems = await insertWalletItems(validItems, session!.user.id, supabase);
        
        setTurns(prev => prev.map(t => t.id === turnId ? {
          ...t, 
          status: 'done', 
          kind: 'wallet',
          confirmationMessage: `Logged as ${validItems[0].type === 'income' ? 'an income' : 'an expense'} in Wallet — ${validItems[0].title}`,
          originalInput: textToProcess
        } : t));
        
      } else if (domain === 'prep') {
        const response = await fetch('/api/rounds-structure', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ text: textToProcess }),
        });
        const data = await response.json();
        if (!response.ok) throw new Error(data.error || 'Failed to process input');
        if (!data.results || !Array.isArray(data.results) || data.results.length === 0) {
          throw new Error("Could not understand that.");
        }
        
        const processedItems = await insertPrepItems(data.results, session!.user.id, supabase);
        
        setTurns(prev => prev.map(t => t.id === turnId ? {
          ...t, 
          status: 'done', 
          kind: 'prep',
          confirmationMessage: `Logged as ${processedItems[0].itemType === 'application' ? 'an application' : processedItems[0].itemType === 'prep' ? 'a prep session' : 'a round'} in Prep — ${processedItems[0].companyName || processedItems[0].prep_type}`,
          originalInput: textToProcess
        } : t));
      } else {
        // organize
        const response = await fetch('/api/structure', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ text: textToProcess, domain: 'organize' }),
        });
        const data = await response.json();
        if (!response.ok) {
          if (data.error === 'rate_limit') throw new Error('RATE_LIMIT');
          throw new Error(data.error || 'Failed to structure text');
        }
        
        const structuredResults = data.results || [data];
        structuredResults[0].originalInput = textToProcess;
        
        const { data: insertedData, error: insertError } = await supabase
          .from('entries')
          .insert({
            user_id: session!.user.id,
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
        setEntries(prev => [newEntry, ...prev]);

        const res = structuredResults[0];
        let snippet = '';
        if (res.type === 'note') snippet = res.body ? res.body.substring(0, 160) : '';
        else if (res.type === 'tasks') snippet = `${res.items?.length || 0} tasks, ${res.items?.filter((i: any) => i.done).length || 0} done. ${res.items?.slice(0, 3).map((i: any) => i.text).join(', ')}`;
        else if (res.type === 'table') snippet = `${res.columns?.join(', ')} (${res.rows?.length || 0} rows)`;
        else if (res.type === 'roadmap') snippet = `${res.goal || ''} (${res.milestones?.length || 0} milestones)`;

        setTurns(prev => prev.map(t => t.id === turnId ? {
          ...t, 
          status: 'done', 
          kind: 'organize',
          entryId: insertedData.id,
          organizePreview: {
             type: res.type,
             title: res.title || 'Untitled',
             snippet
          }
        } : t));
      }
    } catch (err: any) {
      console.error('Structuring error:', err);
      const errMsg = err.message === 'RATE_LIMIT'
        ? "You've hit the AI service's usage limit — please wait a minute and try again"
        : (err.message || "Something went wrong — try rephrasing or try again.");
      
      setTurns(prev => prev.map(t => t.id === turnId ? { ...t, status: 'error', errorMessage: errMsg } : t));
    } finally {
      setLoading(false);
    }
  };

  const handleTurnFixIt = async (turn: Turn, newDomain: string) => {
    await handleStructureIt(newDomain, turn.originalInput || turn.userText, turn.id);
  };

  const handleRegenerateAsk = async (turn: Turn) => {
    if (currentChatEntryId) {
      const chatEntry = entries.find(e => e.id === currentChatEntryId);
      if (chatEntry && chatEntry.results[0]?.messages) {
        const msgs = chatEntry.results[0].messages;
        if (msgs[msgs.length - 1].role === 'assistant') {
          const updatedMessages = msgs.slice(0, -1);
          setEntries(prev => prev.map(e => e.id === currentChatEntryId ? { ...e, results: [{ ...e.results[0], messages: updatedMessages }] } : e));
        }
      }
    }
    await handleStructureIt('ask', turn.originalInput || turn.userText, turn.id);
  };

  const handleStopAsk = () => {
    if (askAbortControllerRef.current) {
      askAbortControllerRef.current.abort();
    }
  };

  const handleFixItList = async (id: string, newDomain: string, originalInput: string) => {
    // Legacy support for EntriesList if needed, though they shouldn't appear anymore.
  };

  const handleStructureSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    void handleStructureIt();
  };

  const handleNewNote = () => {
    setIsMobileMenuOpen(false);
    setActiveEntryId(null);
    setCurrentChatEntryId(null);
    setTurns([]);
    setInputText('');
    if (organizeInputRef.current) {
      organizeInputRef.current.style.height = 'auto';
    }
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

  const handleDelete = async (e: React.MouseEvent, id: string) => {
    e.stopPropagation();
    const entryToDelete = entries.find(n => n.id === id);
    if (!entryToDelete) return;
    
    if (entryToDelete.id.startsWith('temp-')) {
      setEntries(entries.filter((entry) => entry.id !== id));
      if (activeEntryId === id) setActiveEntryId(null);
      if (currentChatEntryId === id) setCurrentChatEntryId(null);
      return;
    }

    const newEntries = entries.filter((entry) => entry.id !== id);
    setEntries(newEntries);
    if (activeEntryId === id) setActiveEntryId(null);
    if (currentChatEntryId === id) setCurrentChatEntryId(null);
    
    showToast('Moved to Trash', 'success', {
      label: 'Undo',
      onClick: async () => {
        setEntries(prev => {
          const restored = [...prev, entryToDelete];
          return restored.sort((a, b) => b.createdAt - a.createdAt);
        });
        await supabase.from('entries').update({ deleted_at: null }).eq('id', id);
      }
    });

    const { error } = await supabase.from('entries').update({ deleted_at: new Date().toISOString() }).eq('id', id);
    if (error) {
      console.error('Failed to soft delete entry', error);
      showToast('Failed to delete note', 'error');
      setEntries(prev => {
        const restored = [...prev, entryToDelete];
        return restored.sort((a, b) => b.createdAt - a.createdAt);
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

  const handleInputResize = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    setInputText(e.target.value);
    e.target.style.height = 'auto';
    e.target.style.height = e.target.scrollHeight + 'px';
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter') {
      if (window.innerWidth < 768) {
        return; // default behavior for mobile
      } else {
        if (!e.shiftKey) {
          e.preventDefault();
          if (inputText.trim() && !loading) {
            handleStructureSubmit(e as any);
          }
        }
      }
    }
  };

  const renderSuggestionChips = (isMobile: boolean) => {
    const chips = [
      { label: "Spent this week?", query: "How much did I spend this week?" },
      { label: "Applications with no update?", query: "Which applications have no update?" },
      { label: "Schedule tomorrow?", query: "What's on my schedule tomorrow?" },
      { label: "Earned this month?", query: "What did I earn this month?" }
    ];
    return (
      <div className={isMobile 
        ? "flex overflow-x-auto snap-x snap-mandatory hide-scrollbar gap-[8px] pl-[16px] pr-12 pb-3 w-full"
        : "hidden md:flex flex-wrap justify-center gap-2 mt-4 pb-2 w-full max-w-3xl mx-auto"
      }>
        {chips.map(({ label, query }) => (
          <button
            key={query}
            onClick={() => handleStructureIt('ask', query)}
            className={`glass-panel-subtle text-white/90 hover:text-white border border-white/10 hover:border-white/20 transition-colors text-[13px] px-3.5 py-2 whitespace-nowrap ${
              isMobile ? "snap-center shrink-0 rounded-full" : "rounded-full"
            }`}
          >
            {label}
          </button>
        ))}
      </div>
    );
  };

  const renderOrganizeForm = (isMobile: boolean) => {
    return (
      <form data-tour="organize-input" onSubmit={handleStructureSubmit} className={`glass-panel-modal border border-white/10 shadow-2xl relative flex flex-row items-end ring-1 ring-white/5 focus-within:border-primary-accent/40 focus-within:ring-primary-accent/20 focus-within:shadow-[0_0_24px_rgba(255,92,56,0.15)] w-full max-w-3xl mx-auto transition-all duration-300 bg-[#1A1A1A] px-[6px] md:px-[8px] gap-[8px] ${isMobile ? 'rounded-[26px]' : 'rounded-[26px] md:rounded-[28px]'}`}>
        <textarea
          ref={organizeInputRef}
          className="flex-1 bg-transparent outline-none text-primary-text text-[16px] md:text-base leading-[24px] placeholder:text-muted-text placeholder:truncate font-sans pl-3 md:pl-4 min-w-0 resize-none max-h-[148px] md:max-h-[152px] py-[14px] md:py-[16px] self-stretch"
          placeholder={isMobilePlaceholder ? "Ask or add anything…" : "Dump a thought, a list, an expense, or ask a question…"}
          value={inputText}
          onChange={handleInputResize}
          onKeyDown={handleKeyDown}
          disabled={loading}
          rows={1}
        />
        
        <div className="shrink-0 flex items-center justify-end gap-[8px] mb-[6px] md:mb-[8px]">
          {speechSupported && (
            <button
              type="button"
              onClick={toggleListening}
              disabled={loading}
              className={`flex items-center justify-center w-[40px] h-[40px] rounded-full transition-all ${
                isListening
                  ? 'bg-primary-accent/20 text-primary-accent shadow-[0_0_15px_rgba(255,92,56,0.2)] animate-pulse'
                  : 'text-muted-text hover:text-primary-text hover:bg-background/50'
              }`}
              title={isListening ? "Stop listening" : "Start voice input"}
            >
              <svg xmlns="http://www.w3.org/2000/svg" className="h-[22px] w-[22px]" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 11a7 7 0 01-7 7m0 0a7 7 0 01-7-7m7 7v4m0 0H8m4 0h4m-4-8a3 3 0 01-3-3V5a3 3 0 116 0v6a3 3 0 01-3 3z" />
              </svg>
            </button>
          )}
          {isStreamingAsk ? (
            <button
              type="button"
              onClick={handleStopAsk}
              className="w-[40px] h-[40px] md:w-auto md:px-5 md:py-2 bg-red-500/20 text-red-500 hover:bg-red-500/30 hover:text-red-400 font-medium rounded-full transition-all flex items-center justify-center gap-2 border border-red-500/30"
            >
              <div className="w-4 h-4 bg-current rounded-[2px]" />
              <span className="hidden md:inline">Stop</span>
            </button>
          ) : (
            <button
              type="submit"
              disabled={loading || !inputText.trim()}
              title={turns.length > 0 && !activeEntryId ? "Send" : undefined}
              className={`flex items-center justify-center rounded-full transition-all gap-2 border font-medium shrink-0 ${
                isMobile
                  ? `w-[40px] h-[40px] ${
                      (!inputText.trim() || loading) 
                        ? 'bg-white/5 text-muted-text/30 cursor-not-allowed border-transparent' 
                        : 'bg-primary-accent text-background hover:brightness-110 border-transparent'
                    }`
                  : `w-[40px] h-[40px] md:w-auto md:px-5 md:py-2 ${
                      (!inputText.trim() || loading) 
                        ? (turns.length > 0 && !activeEntryId ? 'bg-white/5 text-muted-text/30 cursor-not-allowed border-transparent' : 'opacity-40 cursor-not-allowed bg-[#3A221C] text-primary-accent border-primary-accent/20') 
                        : (turns.length > 0 && !activeEntryId ? 'bg-primary-accent text-background hover:brightness-110 border-transparent' : 'bg-[#3A221C] hover:bg-primary-accent hover:text-primary-text hover:shadow-[0_0_15px_rgba(255,92,56,0.3)] text-primary-accent border-primary-accent/20')
                    }`
              }`}
            >
              {loading && turns.length > 0 && !activeEntryId ? (
                <svg className="animate-spin h-5 w-5" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                </svg>
              ) : (turns.length > 0 && !activeEntryId) || isMobile ? (
                <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" className="w-[20px] h-[20px]">
                  <path d="M3.478 2.404a.75.75 0 00-.926.941l2.432 7.905H13.5a.75.75 0 010 1.5H4.984l-2.432 7.905a.75.75 0 00.926.94 60.519 60.519 0 0018.445-8.986.75.75 0 000-1.218A60.517 60.517 0 003.478 2.404z" />
                </svg>
              ) : loading ? (
                <svg className="animate-spin h-5 w-5" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                </svg>
              ) : (
                <>
                  <span className="hidden md:inline">Organize</span>
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" className="hidden md:block">
                    <path d="M12 2L14.5 9.5L22 12L14.5 14.5L12 22L9.5 14.5L2 12L9.5 9.5L12 2Z" fill="currentColor"/>
                  </svg>
                </>
              )}
            </button>
          )}
        </div>
      </form>
    );
  };

  return (
    <div className="overflow-hidden bg-background text-primary-text flex font-sans relative" style={{ height: viewportHeight }}>
      <OnboardingTour userId={session?.user?.id} setIsMobileMenuOpen={setIsMobileMenuOpen} />
      <AppSidebar 
        activePath="/app" 
        isMobileMenuOpen={isMobileMenuOpen} 
        onCloseMenu={() => setIsMobileMenuOpen(false)} 
        session={session} 
        onNewNote={handleNewNote} 
      >
        <div className="px-4 md:px-5 pb-3 space-y-4 shrink-0">
          <div className="flex items-center gap-2">
            <div className="relative flex-1">
              <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 absolute left-3.5 top-3 text-[#8C7E74]" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
              </svg>
              <input
                type="text"
                placeholder="Search"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full pl-10 pr-4 py-2.5 glass-panel-subtle border border-white/10 rounded-2xl text-sm focus:outline-none focus:border-primary-accent/60 transition-all placeholder:text-[#8C7E74] text-primary-text"
              />
            </div>
            <button
              type="button"
              onClick={() => {
                setViewMode(viewMode === 'archived' ? 'normal' : 'archived');
                setActiveEntryId(null);
              }}
              title="Archived"
              className={`shrink-0 p-2.5 rounded-2xl transition-all border ${
                viewMode === 'archived'
                  ? 'glass-panel text-primary-accent border-primary-accent/40 shadow-sm' 
                  : 'glass-panel-subtle text-[#A6988D] border-white/5 hover:border-white/15 hover:text-primary-text'
              }`}
            >
              <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 8h14M5 8a2 2 0 110-4h14a2 2 0 110 4M5 8v10a2 2 0 002 2h10a2 2 0 002-2V8m-9 4h4" />
              </svg>
            </button>
            <button
              type="button"
              onClick={() => {
                setViewMode(viewMode === 'trash' ? 'normal' : 'trash');
                setActiveEntryId(null);
              }}
              title="Trash"
              className={`shrink-0 p-2.5 rounded-2xl transition-all border ${
                viewMode === 'trash'
                  ? 'glass-panel text-primary-accent border-primary-accent/40 shadow-sm' 
                  : 'glass-panel-subtle text-[#A6988D] border-white/5 hover:border-white/15 hover:text-primary-text'
              }`}
            >
              <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
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
                  className={`shrink-0 snap-start px-2.5 py-1 rounded-xl text-[10px] font-mono tracking-wide transition-all border ${
                    activeTagFilter === tag 
                      ? 'glass-panel text-primary-accent border-primary-accent/40 font-semibold'
                      : 'glass-panel-subtle text-[#A6988D] border-white/5 hover:border-white/15 hover:text-primary-text'
                  }`}
                >
                  #{tag}
                </button>
              ))}
            </div>
          )}

          {/* Sort Dropdown */}
          {viewMode !== 'trash' && (
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
          )}
        </div>

        <div className="flex-1 overflow-y-auto overflow-x-hidden px-4 pb-6 space-y-1 md:space-y-2 custom-scrollbar min-h-0">
          {viewMode === 'trash' ? (
            <div className="py-2">
              <TrashList userId={session?.user?.id} onRestore={fetchEntries} onEmpty={() => {}} />
            </div>
          ) : (
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
                if (id) {
                  const entry = entries.find(e => e.id === id);
                  if (entry && entry.results[0]?.type === 'chat') {
                    setActiveEntryId(null);
                    setCurrentChatEntryId(id);
                    const msgs = entry.results[0].messages || [];
                    const loadedTurns: Turn[] = [];
                    for (let i = 0; i < msgs.length; i++) {
                       if (msgs[i].role === 'user') {
                          const userMsg = msgs[i].content;
                          let assistantMsg = '';
                          if (i + 1 < msgs.length && msgs[i+1].role === 'assistant') {
                             assistantMsg = msgs[i+1].content;
                             i++;
                          }
                          loadedTurns.push({
                             id: `turn-${id}-${i}`,
                             userText: userMsg,
                             status: 'done',
                             kind: 'ask',
                             answer: assistantMsg
                          });
                       }
                    }
                    setTurns(loadedTurns);
                    if (window.innerWidth < 768) setIsMobileMenuOpen(false);
                    return;
                  }
                }
                setActiveEntryId(id);
              }}
              setIsMobileMenuOpen={setIsMobileMenuOpen}
              setEditingTitle={setEditingTitle}
              handleRenameKeyDown={handleRenameKeyDown}
              saveRename={saveRename}
              handleTogglePin={handleTogglePin}
              startRename={startRename}
              handleDelete={handleDelete}
              showArchived={viewMode === 'archived'}
              handleArchiveToggle={handleArchiveToggle}
              onFixIt={handleFixItList}
            />
          )}
        </div>

      </AppSidebar>

      {/* Main Content */}
      <div className="flex-1 flex flex-col min-w-0 h-[100dvh]">
      <main className="flex-1 overflow-y-auto flex flex-col w-full min-w-0">
        
        {/* Mobile Header */}
        <AppMobileHeader 
          className={turns.length > 0 && !activeEntryId ? "bg-background/80 backdrop-blur-xl border-white/5" : ""}
          onOpenMenu={() => setIsMobileMenuOpen(true)} 
          rightContent={
            saveState !== 'idle' ? (
              <span className="text-xs font-mono text-muted-text/60">
                {saveState === 'saving' ? 'Saving...' : 'Saved'}
              </span>
            ) : null
          }
        />

        <div className="flex-1 flex flex-col items-center">
          {!activeEntry ? (
            turns.length === 0 ? (
              <div className="flex-1 flex flex-col w-full relative">
                {/* Free space centered greeting */}
                <div className="flex-1 flex flex-col items-center justify-center px-4 w-full relative z-10 mb-8 md:mb-12 text-center max-w-[800px] mx-auto min-h-0">
                  <div aria-hidden="true" className="ambient-glow-hero absolute inset-0 -z-10" />
                  <button
                    type="button"
                    onClick={() => router.push('/app?tour=true')}
                    className="mb-5 px-3.5 py-1.5 rounded-full glass-panel-subtle text-muted-text border border-white/10 hover:border-primary-accent/40 hover:text-primary-accent transition-all text-xs font-medium flex items-center gap-2 shadow-sm group"
                  >
                    <svg xmlns="http://www.w3.org/2000/svg" className="h-3.5 w-3.5 group-hover:animate-pulse" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253" />
                    </svg>
                    Take a tour
                  </button>
                  <h1 className="font-serif italic font-bold text-4xl md:text-[40px] lg:text-[44px] tracking-tight leading-[1.1] mb-3 flex flex-col items-center">
                    <span className="text-primary-text">What's on your</span>
                    <span className="text-primary-accent mt-1">mind?</span>
                  </h1>
                
                  <p className="text-base md:text-lg text-muted-text font-medium max-w-2xl mx-auto">
                    Dump anything here — I'll turn it into notes, tasks, and tables.
                  </p>
                  
                  {/* Desktop Empty State Form */}
                  {!isMobilePlaceholder && (
                    <div className="w-full max-w-3xl mt-8 relative">
                      {renderOrganizeForm(false)}
                      {renderSuggestionChips(false)}
                    </div>
                  )}
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
              <div className="flex-1 flex flex-col w-full max-w-[1000px] mx-auto min-h-0 pb-6">
                <ThreadView 
                   turns={turns} 
                   isProcessing={loading} 
                   onRetry={(turn) => handleStructureIt(turn.kind, turn.userText, turn.id)}
                   onOpenEntry={(id) => setActiveEntryId(id)}
                   onFixIt={handleTurnFixIt}
                   onSaveAs={(turn, domain) => handleTurnFixIt(turn, domain)}
                />
              </div>
            )
        ) : (
          <div className="w-full flex-1 overflow-y-auto">
            <div className="w-full max-w-4xl px-4 md:px-8 py-4 sticky top-0 bg-background/80 backdrop-blur-xl z-20 border-b border-hairline flex items-center justify-between">
              <button
                onClick={() => setActiveEntryId(null)}
                className="flex items-center gap-2 text-sm text-muted-text hover:text-primary-text transition-colors"
              >
                <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 19l-7-7m0 0l7-7m-7 7h18" />
                </svg>
                Back to chat
              </button>
            </div>
            <div className="w-full max-w-4xl mx-auto px-4 md:px-8 py-8 md:py-10 space-y-6 md:space-y-8 relative">
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
        </div>
        )}
        </div>
      </main>

      {/* Mobile Empty State Input Box */}
      {!activeEntry && turns.length === 0 && isMobilePlaceholder && (
        <div className="shrink-0 bg-background z-20 w-full pb-[max(env(safe-area-inset-bottom),12px)] flex flex-col relative">
          <div className="absolute bottom-full left-0 right-0 h-16 bg-gradient-to-t from-background to-transparent pointer-events-none z-10" />
          <div className="absolute right-0 top-0 w-12 h-[64px] bg-gradient-to-l from-background to-transparent pointer-events-none z-10" />
          {renderSuggestionChips(true)}
          <div className="px-3">
            {renderOrganizeForm(true)}
          </div>
        </div>
      )}

      {/* Unified Thread Mode Input Box (Desktop & Mobile) */}
      {!activeEntry && turns.length > 0 && (
        <div className="shrink-0 w-full relative pb-[max(env(safe-area-inset-bottom),12px)] px-[12px] md:px-0 bg-background md:bg-transparent z-20">
          <div className="absolute bottom-[100%] left-0 right-0 h-12 bg-gradient-to-t from-background to-transparent pointer-events-none z-10" />
          <div className="max-w-3xl mx-auto w-full pt-3 md:pt-4 pb-3 relative z-20">
            {renderOrganizeForm(isMobilePlaceholder)}
          </div>
        </div>
      )}
      </div>
    </div>
  );
}
