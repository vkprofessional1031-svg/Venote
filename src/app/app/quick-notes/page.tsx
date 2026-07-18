'use client';

import { useState, useEffect, useRef } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { supabase } from '@/lib/supabase';

interface QuickNote {
  id: string;
  title: string;
  body: string;
  fontFamily: string;
  fontSize: string;
  textAlign: string;
  isBold: boolean;
  isItalic: boolean;
  isUnderline: boolean;
  createdAt: number;
  updatedAt: number;
  isArchived?: boolean;
  imageUrls?: string[];
}

export default function QuickNotesPage() {
  const router = useRouter();
  
  // Auth State
  const [session, setSession] = useState<any>(null);
  const [authLoading, setAuthLoading] = useState(true);

  // Notes State
  const [notes, setNotes] = useState<QuickNote[]>([]);
  const [notesLoading, setNotesLoading] = useState(true);
  const [activeNoteId, setActiveNoteId] = useState<string | null>(null);
  
  // UI State
  const [searchQuery, setSearchQuery] = useState('');
  const [showArchived, setShowArchived] = useState(false);
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [isStyleSheetOpen, setIsStyleSheetOpen] = useState(false);
  const [saveState, setSaveState] = useState<'idle' | 'saving' | 'saved'>('idle');
  const [isUploading, setIsUploading] = useState(false);
  const [lightboxUrl, setLightboxUrl] = useState<string | null>(null);
  const debounceTimerRef = useRef<NodeJS.Timeout | null>(null);
  const bodyInputRef = useRef<HTMLTextAreaElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Initialize Auth
  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
      setAuthLoading(false);
      if (!session) router.push('/login');
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

  // Fetch Notes
  useEffect(() => {
    if (authLoading || !session?.user?.id) return;
    
    const fetchNotes = async () => {
      setNotesLoading(true);
      try {
        const { data, error } = await supabase
          .from('quick_notes')
          .select('*')
          .eq('user_id', session.user.id)
          .order('created_at', { ascending: false });
          
        if (error) throw error;
        
        if (data) {
          const formatted = data.map(row => ({
            id: row.id,
            title: row.title || '',
            body: row.body || '',
            fontFamily: row.font_family || 'Plus Jakarta Sans',
            fontSize: row.font_size || '15px',
            textAlign: row.text_align || 'left',
            isBold: row.is_bold || false,
            isItalic: row.is_italic || false,
            isUnderline: row.is_underline || false,
            createdAt: new Date(row.created_at).getTime(),
            updatedAt: row.updated_at ? new Date(row.updated_at).getTime() : new Date(row.created_at).getTime(),
            isArchived: row.is_archived || false,
            imageUrls: row.image_urls || []
          }));
          setNotes(formatted);
        }
      } catch (err) {
        console.error('Failed to fetch quick notes:', err);
      } finally {
        setNotesLoading(false);
      }
    };
    
    fetchNotes();
  }, [session, authLoading]);

  // Handle New Note
  const handleNewNote = async () => {
    setIsMobileMenuOpen(false);
    if (!session) return;
    
    try {
      const { data, error } = await supabase
        .from('quick_notes')
        .insert({
          user_id: session.user.id,
          title: '',
          body: ''
        })
        .select()
        .single();
        
      if (error) throw error;

      const newNote: QuickNote = {
        id: data.id,
        title: data.title || '',
        body: data.body || '',
        fontFamily: data.font_family || 'Plus Jakarta Sans',
        fontSize: data.font_size || '15px',
        textAlign: data.text_align || 'left',
        isBold: data.is_bold || false,
        isItalic: data.is_italic || false,
        isUnderline: data.is_underline || false,
        createdAt: new Date(data.created_at).getTime(),
        updatedAt: new Date(data.created_at).getTime(), // same as created
        imageUrls: []
      };

      setNotes(prev => [newNote, ...prev]);
      setActiveNoteId(newNote.id);
    } catch (err) {
      console.error('Failed to create new quick note:', err);
    }
  };

  const handleArchiveToggle = async (e: React.MouseEvent, id: string, currentArchived: boolean) => {
    e.stopPropagation();
    const newArchivedState = !currentArchived;
    
    setNotes(notes.map(note => 
      note.id === id ? { ...note, isArchived: newArchivedState } : note
    ));
    
    const { error } = await supabase.from('quick_notes').update({
      is_archived: newArchivedState,
      updated_at: new Date().toISOString()
    }).eq('id', id);

    if (error) {
      console.error('Failed to update archive state', error);
    } else {
      if (newArchivedState && activeNoteId === id) {
        setActiveNoteId(null);
      }
    }
  };

  // Handle Update Note
  const handleUpdate = (id: string, updates: Partial<QuickNote>) => {
    const noteIndex = notes.findIndex(n => n.id === id);
    if (noteIndex === -1) return;

    setSaveState('saving');
    
    const note = notes[noteIndex];
    const updatedNote = { ...note, ...updates, updatedAt: Date.now() };
    
    const newNotes = [...notes];
    newNotes[noteIndex] = updatedNote;
    setNotes(newNotes);

    if (debounceTimerRef.current) clearTimeout(debounceTimerRef.current);
    debounceTimerRef.current = setTimeout(async () => {
      const { error } = await supabase.from('quick_notes').update({
        title: updatedNote.title,
        body: updatedNote.body,
        font_family: updatedNote.fontFamily,
        font_size: updatedNote.fontSize,
        text_align: updatedNote.textAlign,
        is_bold: updatedNote.isBold,
        is_italic: updatedNote.isItalic,
        is_underline: updatedNote.isUnderline,
        image_urls: updatedNote.imageUrls,
        updated_at: new Date().toISOString()
      }).eq('id', id);

      if (error) {
        console.error('Failed to update quick note:', error);
        setSaveState('idle');
      } else {
        setSaveState('saved');
        setTimeout(() => setSaveState('idle'), 2000);
      }
    }, 800);
  };

  const handleUpdateImages = (id: string, newUrls: string[]) => {
    setNotes(prevNotes => prevNotes.map(note => 
      note.id === id ? { ...note, imageUrls: newUrls } : note
    ));
    supabase.from('quick_notes').update({
      image_urls: newUrls,
      updated_at: new Date().toISOString()
    }).eq('id', id).then(({error}) => {
      if (error) {
        console.error('Failed to update images', error);
      }
    });
  };

  const handleFileUpload = async (files: FileList | File[], noteId: string, currentUrls: string[]) => {
    if (!session?.user?.id) return;
    
    const imageFiles = Array.from(files).filter(f => f.type.startsWith('image/'));
    if (imageFiles.length === 0) return;

    setIsUploading(true);
    const newUrls = [...currentUrls];
    const uploadPathPrefix = `${session.user.id}/quick/${noteId}`;

    for (const file of imageFiles) {
      if (file.size > 10 * 1024 * 1024) continue;
      
      const fileName = `${Date.now()}_${file.name.replace(/[^a-zA-Z0-9.-]/g, '_')}`;
      const filePath = `${uploadPathPrefix}/${fileName}`;

      const { error: uploadError } = await supabase.storage.from('note-images').upload(filePath, file);

      if (uploadError) {
        console.error('Upload failed:', uploadError);
        continue;
      }

      const { data: { publicUrl } } = supabase.storage.from('note-images').getPublicUrl(filePath);
      newUrls.push(publicUrl);
    }

    if (newUrls.length > currentUrls.length) {
      handleUpdateImages(noteId, newUrls);
    }
    
    setIsUploading(false);
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const handleDeleteImage = async (e: React.MouseEvent, noteId: string, currentUrls: string[], urlToRemove: string) => {
    e.stopPropagation();

    try {
      const urlObj = new URL(urlToRemove);
      const parts = urlObj.pathname.split('/note-images/');
      if (parts.length > 1) {
        await supabase.storage.from('note-images').remove([parts[1]]);
      }
    } catch (err) {
      console.error('Failed to parse URL for deletion', err);
    }

    handleUpdateImages(noteId, currentUrls.filter(u => u !== urlToRemove));
  };
  
  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    if (activeNoteId && e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      const activeNote = notes.find(n => n.id === activeNoteId);
      if (activeNote) handleFileUpload(e.dataTransfer.files, activeNoteId, activeNote.imageUrls || []);
    }
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
  };

  const handlePaste = (e: React.ClipboardEvent) => {
    if (activeNoteId && e.clipboardData.files && e.clipboardData.files.length > 0) {
      const activeNote = notes.find(n => n.id === activeNoteId);
      if (activeNote) handleFileUpload(e.clipboardData.files, activeNoteId, activeNote.imageUrls || []);
    }
  };

  // Adjust textarea height automatically
  useEffect(() => {
    if (bodyInputRef.current) {
      bodyInputRef.current.style.height = 'auto';
      bodyInputRef.current.style.height = bodyInputRef.current.scrollHeight + 'px';
    }
  });

  const activeNote = notes.find(n => n.id === activeNoteId);

  const filteredNotes = notes.filter(n => {
    if (showArchived) {
      if (!n.isArchived) return false;
    } else {
      if (n.isArchived) return false;
    }
    return n.title.toLowerCase().includes(searchQuery.toLowerCase()) || 
           n.body.toLowerCase().includes(searchQuery.toLowerCase());
  });

  if (authLoading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="w-8 h-8 border-4 border-primary-accent border-t-transparent rounded-full animate-spin"></div>
      </div>
    );
  }

  return (
    <div className="flex h-[100dvh] md:h-screen bg-background overflow-hidden font-sans text-primary-text selection:bg-primary-accent/30 selection:text-primary-text">
      
      {/* Mobile Menu Overlay */}
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

          <Link
            href="/app"
            className="w-full flex items-center justify-start gap-2 px-4 py-2.5 bg-background/50 text-muted-text hover:text-primary-text font-medium rounded-xl hover:bg-background transition-all border border-transparent hover:border-hairline"
          >
            <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" />
            </svg>
            Organize
          </Link>

          <button
            type="button"
            onClick={handleNewNote}
            className="w-full flex items-center justify-center gap-2 px-4 py-3 bg-primary-accent text-primary-text font-medium rounded-xl hover:brightness-110 transition-all shadow-[0_4px_14px_0_rgba(255,92,56,0.39)]"
          >
            <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" viewBox="0 0 20 20" fill="currentColor">
              <path fillRule="evenodd" d="M10 3a1 1 0 011 1v5h5a1 1 0 110 2h-5v5a1 1 0 11-2 0v-5H4a1 1 0 110-2h5V4a1 1 0 011-1z" clipRule="evenodd" />
            </svg>
            New Quick Note
          </button>

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
                setActiveNoteId(null);
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

        </div>

        <div className="flex-1 overflow-y-auto px-4 pb-4 space-y-1 custom-scrollbar">
          {notesLoading ? (
            <div className="flex justify-center p-4">
              <svg className="animate-spin h-5 w-5 text-muted-text" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
              </svg>
            </div>
          ) : notes.length === 0 ? (
            <div className="p-4 text-center text-sm text-muted-text bg-[#1A1714] rounded-xl border border-hairline border-dashed">
              No quick notes yet.
            </div>
          ) : filteredNotes.length === 0 ? (
            <div className="p-4 text-center text-sm text-muted-text bg-[#1A1714] rounded-xl border border-hairline border-dashed">
              No notes found.
            </div>
          ) : (
            filteredNotes.map((note) => (
              <div
                key={note.id}
                onClick={() => {
                  setActiveNoteId(note.id);
                  setIsMobileMenuOpen(false);
                }}
                className={`w-full text-left p-3 rounded-xl transition-all cursor-pointer border-l-2 group relative ${
                  activeNoteId === note.id
                    ? 'bg-primary-accent/5 border-primary-accent'
                    : 'hover:bg-card border-transparent'
                }`}
              >
                <div className="pr-8">
                  <h3 className="font-serif italic font-bold text-lg text-primary-text truncate tracking-tight">
                    {note.title || 'Untitled'}
                  </h3>
                  <p className="text-xs text-muted-text truncate mt-1">
                    {note.body || 'No content'}
                  </p>
                </div>

                <div className="absolute right-2 top-1/2 -translate-y-1/2 opacity-0 group-hover:opacity-100 transition-opacity">
                  <button
                    type="button"
                    onClick={(e) => handleArchiveToggle(e, note.id, !!note.isArchived)}
                    className="p-2 text-muted-text hover:text-primary-text hover:bg-background/50 rounded transition-colors"
                    title={showArchived ? "Unarchive" : "Archive"}
                  >
                    {showArchived ? (
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
                </div>
              </div>
            ))
          )}
        </div>
      </aside>

      {/* Main Content */}
      <main className="flex-1 overflow-y-auto flex flex-col w-full min-w-0">
        
        {/* Mobile Header */}
        <div className="md:hidden flex items-center justify-between p-4 border-b border-hairline bg-background sticky top-0 z-30">
          <div className="flex items-center gap-3">
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
          </div>
          {saveState !== 'idle' && (
            <span className="text-xs font-mono text-muted-text/60">
              {saveState === 'saving' ? 'Saving...' : 'Saved'}
            </span>
          )}
        </div>

        <div className="flex-1 flex flex-col items-center">
          {!activeNote ? (
            <div className="w-full max-w-[800px] px-4 py-8 pb-32 md:px-8 md:py-20 flex flex-col items-center justify-center min-h-[80vh] md:min-h-screen">
              <div className="flex flex-col items-center mb-8 md:mb-12 text-center w-full">
                <h1 className="font-serif italic font-bold text-4xl md:text-[40px] lg:text-[44px] tracking-tight leading-[1.1] mb-3 flex flex-col items-center text-muted-text">
                  Quick Notes
                </h1>
                <p className="text-base md:text-lg text-muted-text font-medium max-w-2xl mx-auto">
                  Select a note from the sidebar or create a new one.
                </p>
              </div>
            </div>
          ) : (
            <div className="w-full max-w-4xl px-4 md:px-8 py-8 md:py-16 space-y-6 relative">
              <div 
                className="w-full bg-card rounded-[24px] overflow-hidden shadow-sm border border-transparent transition-colors"
                onDrop={handleDrop}
                onDragOver={handleDragOver}
              >
                <div className="p-4 md:p-6 lg:p-8">
                  <div className="flex flex-col md:flex-row md:items-center justify-between mb-4 md:mb-6 gap-3 md:gap-0 relative">
                    <div className="flex items-center gap-3 flex-wrap">
                      <span className="font-mono text-[10px] tracking-widest uppercase px-2 py-1 rounded bg-tertiary-accent/10 text-tertiary-accent flex items-center gap-1.5 font-bold shrink-0">
                      <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" /></svg>
                      QUICK NOTE
                    </span>

                    {/* Desktop Toolbar */}
                    <div className="hidden md:flex items-center gap-1 p-1 bg-[#1A1714] border border-hairline rounded-lg w-fit">
                      <select
                        value={activeNote.fontFamily}
                        onChange={(e) => handleUpdate(activeNote.id, { fontFamily: e.target.value })}
                        className="bg-transparent text-[13px] text-primary-text outline-none cursor-pointer border-none pl-1.5 pr-0.5"
                      >
                        <option value="Plus Jakarta Sans" className="bg-[#1A1714]">Plus Jakarta Sans</option>
                        <option value="Fraunces" className="bg-[#1A1714]">Fraunces</option>
                        <option value="Lora" className="bg-[#1A1714]">Lora</option>
                        <option value="Space Mono" className="bg-[#1A1714]">Space Mono</option>
                      </select>

                      <div className="w-px h-3.5 bg-hairline mx-1" />

                      <select
                        value={activeNote.fontSize}
                        onChange={(e) => handleUpdate(activeNote.id, { fontSize: e.target.value })}
                        className="bg-transparent text-[13px] text-primary-text outline-none cursor-pointer border-none pl-1.5 pr-0.5"
                      >
                        <option value="13px" className="bg-[#1A1714]">13px</option>
                        <option value="15px" className="bg-[#1A1714]">15px</option>
                        <option value="17px" className="bg-[#1A1714]">17px</option>
                        <option value="20px" className="bg-[#1A1714]">20px</option>
                      </select>

                      <div className="w-px h-3.5 bg-hairline mx-1" />

                      <div className="flex items-center gap-0.5">
                        <button
                          type="button"
                          onClick={() => handleUpdate(activeNote.id, { isBold: !activeNote.isBold })}
                          className={`p-1 rounded hover:bg-white/5 transition-colors ${activeNote.isBold ? 'text-[#FF5C38]' : 'text-muted-text hover:text-primary-text'}`}
                        >
                          <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M6 4h8a4 4 0 0 1 4 4 4 4 0 0 1-4 4H6z"></path><path d="M6 12h9a4 4 0 0 1 4 4 4 4 0 0 1-4 4H6z"></path></svg>
                        </button>
                        <button
                          type="button"
                          onClick={() => handleUpdate(activeNote.id, { isItalic: !activeNote.isItalic })}
                          className={`p-1 rounded hover:bg-white/5 transition-colors ${activeNote.isItalic ? 'text-[#FF5C38]' : 'text-muted-text hover:text-primary-text'}`}
                        >
                          <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="19" y1="4" x2="10" y2="4"></line><line x1="14" y1="20" x2="5" y2="20"></line><line x1="15" y1="4" x2="9" y2="20"></line></svg>
                        </button>
                        <button
                          type="button"
                          onClick={() => handleUpdate(activeNote.id, { isUnderline: !activeNote.isUnderline })}
                          className={`p-1 rounded hover:bg-white/5 transition-colors ${activeNote.isUnderline ? 'text-[#FF5C38]' : 'text-muted-text hover:text-primary-text'}`}
                        >
                          <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M6 3v7a6 6 0 0 0 6 6 6 6 0 0 0 6-6V3"></path><line x1="4" y1="21" x2="20" y2="21"></line></svg>
                        </button>
                      </div>

                      <div className="w-px h-3.5 bg-hairline mx-1" />

                      <div className="flex items-center gap-0.5">
                        <button
                          type="button"
                          onClick={() => handleUpdate(activeNote.id, { textAlign: 'left' })}
                          className={`p-1 rounded hover:bg-white/5 transition-colors ${activeNote.textAlign === 'left' ? 'text-[#FF5C38]' : 'text-muted-text hover:text-primary-text'}`}
                        >
                          <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="21" y1="6" x2="3" y2="6"></line><line x1="15" y1="12" x2="3" y2="12"></line><line x1="17" y1="18" x2="3" y2="18"></line></svg>
                        </button>
                        <button
                          type="button"
                          onClick={() => handleUpdate(activeNote.id, { textAlign: 'center' })}
                          className={`p-1 rounded hover:bg-white/5 transition-colors ${activeNote.textAlign === 'center' ? 'text-[#FF5C38]' : 'text-muted-text hover:text-primary-text'}`}
                        >
                          <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="21" y1="6" x2="3" y2="6"></line><line x1="19" y1="12" x2="5" y2="12"></line><line x1="21" y1="18" x2="3" y2="18"></line></svg>
                        </button>
                        <button
                          type="button"
                          onClick={() => handleUpdate(activeNote.id, { textAlign: 'right' })}
                          className={`p-1 rounded hover:bg-white/5 transition-colors ${activeNote.textAlign === 'right' ? 'text-[#FF5C38]' : 'text-muted-text hover:text-primary-text'}`}
                        >
                          <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="21" y1="6" x2="3" y2="6"></line><line x1="21" y1="12" x2="9" y2="12"></line><line x1="21" y1="18" x2="7" y2="18"></line></svg>
                        </button>
                      </div>

                      <div className="w-px h-3.5 bg-hairline mx-1" />

                      <div className="flex items-center gap-0.5">
                        <button
                          type="button"
                          onClick={() => fileInputRef.current?.click()}
                          className="p-1 rounded text-muted-text hover:text-primary-text hover:bg-white/5 transition-colors"
                          title="Add Image"
                        >
                          <svg xmlns="http://www.w3.org/2000/svg" className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                          </svg>
                        </button>
                        <input 
                          type="file" 
                          ref={fileInputRef} 
                          hidden 
                          accept="image/*" 
                          multiple 
                          onChange={(e) => {
                            if (e.target.files && activeNoteId) {
                              const note = notes.find(n => n.id === activeNoteId);
                              if (note) handleFileUpload(e.target.files, activeNoteId, note.imageUrls || []);
                            }
                          }}
                        />
                      </div>
                      </div>
                    </div>
                    
                    <div className="flex items-center gap-3 self-end md:self-auto shrink-0">
                      {saveState && saveState !== 'idle' && (
                        <span className={`font-mono text-[10px] tracking-wide ${saveState === 'saving' ? 'text-amber-500/70' : 'text-[#8A9A5B]'}`}>
                          {saveState === 'saving' ? 'Saving...' : 'Saved'}
                        </span>
                      )}
                      <div className="flex items-center gap-1">
                        <button
                          type="button"
                          onClick={(e) => handleArchiveToggle(e, activeNote.id, !!activeNote.isArchived)}
                          className="p-1.5 text-muted-text hover:text-primary-text hover:bg-white/5 rounded-lg transition-colors"
                          title={activeNote.isArchived ? "Unarchive" : "Archive"}
                        >
                          {activeNote.isArchived ? (
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
                      </div>
                    </div>
                  </div>
                  
                  <input
                    type="text"
                    value={activeNote.title}
                    onChange={(e) => handleUpdate(activeNote.id, { title: e.target.value })}
                    placeholder="Note title..."
                    className="w-full font-serif italic font-bold text-3xl md:text-4xl text-primary-text bg-transparent outline-none placeholder:text-muted-text/30 mb-4 tracking-tight leading-[1.1]"
                  />


                  <textarea
                    ref={bodyInputRef}
                    value={activeNote.body}
                    onChange={(e) => handleUpdate(activeNote.id, { body: e.target.value })}
                    placeholder="Write your note here..."
                    style={{
                      fontFamily: `var(--font-${activeNote.fontFamily.toLowerCase().replace(/ /g, '-')}), ${activeNote.fontFamily}, sans-serif`,
                      fontSize: activeNote.fontSize,
                      textAlign: activeNote.textAlign as any,
                      fontWeight: activeNote.isBold ? 'bold' : 'normal',
                      fontStyle: activeNote.isItalic ? 'italic' : 'normal',
                      textDecoration: activeNote.isUnderline ? 'underline' : 'none'
                    }}
                    className="w-full bg-transparent outline-none text-muted-text hover:text-primary-text focus:text-primary-text resize-none min-h-[120px] transition-colors leading-relaxed placeholder:text-muted-text/30"
                    onPaste={handlePaste}
                  />

                  {/* Image Thumbnails */}
                  {(activeNote.imageUrls?.length || isUploading) ? (
                    <div className="mt-6 pt-4 border-t border-hairline/50">
                      <div className="flex flex-wrap gap-3">
                        {activeNote.imageUrls?.map((url, i) => (
                          <div key={i} className="relative group w-20 h-20 rounded-lg overflow-hidden border border-hairline bg-black/20 shrink-0">
                            <img 
                              src={url} 
                              alt="Attachment" 
                              className="w-full h-full object-cover cursor-pointer hover:opacity-90 transition-opacity" 
                              onClick={() => setLightboxUrl(url)}
                            />
                            <button
                              type="button"
                              onClick={(e) => handleDeleteImage(e, activeNote.id, activeNote.imageUrls || [], url)}
                              className="absolute top-1 right-1 p-1 bg-black/60 text-white rounded-full opacity-0 group-hover:opacity-100 transition-opacity hover:bg-red-500"
                            >
                              <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12"/></svg>
                            </button>
                          </div>
                        ))}
                        {isUploading && (
                          <div className="w-20 h-20 rounded-lg border border-hairline border-dashed bg-black/10 flex items-center justify-center animate-pulse shrink-0">
                            <svg className="animate-spin h-5 w-5 text-muted-text" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                            </svg>
                          </div>
                        )}
                      </div>
                    </div>
                  ) : null}
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Mobile Floating Button */}
        {activeNote && (
          <button
            type="button"
            onClick={() => setIsStyleSheetOpen(true)}
            className="md:hidden fixed bottom-6 right-6 w-14 h-14 bg-card border border-hairline rounded-full shadow-lg flex items-center justify-center text-primary-text hover:bg-white/5 transition-colors z-30"
          >
            <span className="font-serif italic font-bold text-xl leading-none">Aa</span>
          </button>
        )}

        {/* Mobile Bottom Sheet */}
        {isStyleSheetOpen && activeNote && (
          <>
            <div 
              className="fixed inset-0 bg-black/60 backdrop-blur-sm z-40 md:hidden"
              onClick={() => setIsStyleSheetOpen(false)}
            />
            <div className="fixed bottom-0 left-0 right-0 bg-card border-t border-hairline rounded-t-3xl p-6 z-50 md:hidden animate-in slide-in-from-bottom shadow-2xl safe-area-pb pb-8">
              <div className="w-12 h-1.5 bg-white/10 rounded-full mx-auto mb-6" />
              
              <div className="space-y-6">
                <div>
                  <h4 className="text-xs font-mono tracking-wider text-muted-text uppercase mb-3">Font</h4>
                  <div className="grid grid-cols-2 gap-2">
                    {['Plus Jakarta Sans', 'Fraunces', 'Lora', 'Space Mono'].map((font) => (
                      <button
                        key={font}
                        type="button"
                        onClick={() => handleUpdate(activeNote.id, { fontFamily: font })}
                        className={`p-2.5 rounded-xl text-sm border transition-all ${activeNote.fontFamily === font ? 'bg-primary-accent/10 border-primary-accent text-primary-accent' : 'border-hairline text-muted-text bg-[#1A1714]'}`}
                      >
                        {font}
                      </button>
                    ))}
                  </div>
                </div>

                <div>
                  <h4 className="text-xs font-mono tracking-wider text-muted-text uppercase mb-3">Size</h4>
                  <div className="grid grid-cols-4 gap-2">
                    {['13px', '15px', '17px', '20px'].map((size) => (
                      <button
                        key={size}
                        type="button"
                        onClick={() => handleUpdate(activeNote.id, { fontSize: size })}
                        className={`p-2.5 rounded-xl text-sm border transition-all ${activeNote.fontSize === size ? 'bg-primary-accent/10 border-primary-accent text-primary-accent' : 'border-hairline text-muted-text bg-[#1A1714]'}`}
                      >
                        {size.replace('px', '')}
                      </button>
                    ))}
                  </div>
                </div>

                <div>
                  <h4 className="text-xs font-mono tracking-wider text-muted-text uppercase mb-3">Style and align</h4>
                  <div className="flex gap-2">
                    <div className="grid grid-cols-3 gap-2 flex-1">
                      <button
                        type="button"
                        onClick={() => handleUpdate(activeNote.id, { isBold: !activeNote.isBold })}
                        className={`p-2.5 rounded-xl flex items-center justify-center border transition-all ${activeNote.isBold ? 'bg-primary-accent/10 border-primary-accent text-primary-accent' : 'border-hairline text-muted-text bg-[#1A1714]'}`}
                      >
                        <span className="font-bold font-serif text-lg leading-none pt-1">B</span>
                      </button>
                      <button
                        type="button"
                        onClick={() => handleUpdate(activeNote.id, { isItalic: !activeNote.isItalic })}
                        className={`p-2.5 rounded-xl flex items-center justify-center border transition-all ${activeNote.isItalic ? 'bg-primary-accent/10 border-primary-accent text-primary-accent' : 'border-hairline text-muted-text bg-[#1A1714]'}`}
                      >
                        <span className="italic font-serif text-lg leading-none pt-1">I</span>
                      </button>
                      <button
                        type="button"
                        onClick={() => handleUpdate(activeNote.id, { isUnderline: !activeNote.isUnderline })}
                        className={`p-2.5 rounded-xl flex items-center justify-center border transition-all ${activeNote.isUnderline ? 'bg-primary-accent/10 border-primary-accent text-primary-accent' : 'border-hairline text-muted-text bg-[#1A1714]'}`}
                      >
                        <span className="underline font-serif text-lg leading-none pt-1">U</span>
                      </button>
                    </div>
                    <div className="w-px bg-hairline my-2" />
                    <div className="grid grid-cols-3 gap-2 flex-1">
                      <button
                        type="button"
                        onClick={() => handleUpdate(activeNote.id, { textAlign: 'left' })}
                        className={`p-2.5 rounded-xl flex items-center justify-center border transition-all ${activeNote.textAlign === 'left' ? 'bg-primary-accent/10 border-primary-accent text-primary-accent' : 'border-hairline text-muted-text bg-[#1A1714]'}`}
                      >
                        <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><line x1="21" y1="6" x2="3" y2="6"></line><line x1="15" y1="12" x2="3" y2="12"></line><line x1="17" y1="18" x2="3" y2="18"></line></svg>
                      </button>
                      <button
                        type="button"
                        onClick={() => handleUpdate(activeNote.id, { textAlign: 'center' })}
                        className={`p-2.5 rounded-xl flex items-center justify-center border transition-all ${activeNote.textAlign === 'center' ? 'bg-primary-accent/10 border-primary-accent text-primary-accent' : 'border-hairline text-muted-text bg-[#1A1714]'}`}
                      >
                        <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><line x1="21" y1="6" x2="3" y2="6"></line><line x1="19" y1="12" x2="5" y2="12"></line><line x1="21" y1="18" x2="3" y2="18"></line></svg>
                      </button>
                      <button
                        type="button"
                        onClick={() => handleUpdate(activeNote.id, { textAlign: 'right' })}
                        className={`p-2.5 rounded-xl flex items-center justify-center border transition-all ${activeNote.textAlign === 'right' ? 'bg-primary-accent/10 border-primary-accent text-primary-accent' : 'border-hairline text-muted-text bg-[#1A1714]'}`}
                      >
                        <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><line x1="21" y1="6" x2="3" y2="6"></line><line x1="21" y1="12" x2="9" y2="12"></line><line x1="21" y1="18" x2="7" y2="18"></line></svg>
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </>
        )}
      </main>

      {/* Lightbox */}
      {lightboxUrl && (
        <div 
          className="fixed inset-0 z-[100] bg-black/90 backdrop-blur-sm flex items-center justify-center p-4 md:p-8"
          onClick={() => setLightboxUrl(null)}
        >
          <div className="relative max-w-full max-h-full">
            <button 
              className="absolute -top-12 right-0 p-2 text-white/70 hover:text-white bg-black/50 hover:bg-black/80 rounded-full transition-colors"
              onClick={() => setLightboxUrl(null)}
            >
              <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12"/></svg>
            </button>
            <img 
              src={lightboxUrl} 
              alt="Enlarged attachment" 
              className="max-w-full max-h-[85vh] object-contain rounded shadow-2xl" 
              onClick={(e) => e.stopPropagation()}
            />
          </div>
        </div>
      )}
    </div>
  );
}
