'use client';

import { useState, useEffect, useRef } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { supabase } from '@/lib/supabase';
import AppSidebar from '@/components/AppSidebar';
import AppMobileHeader from '@/components/AppMobileHeader';
import { NoteEditor, NoteEditorRef } from '@/components/NoteEditor';

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
}

function getPreviewText(body: string): string {
  if (!body) return '';
  const stripped = body
    .replace(/<img[^>]*>/gi, '')           // remove inline images entirely, no placeholder
    .replace(/!\[.*?\]\(.*?\)/g, '')       // remove markdown image syntax too
    .replace(/<[^>]+>/g, '')               // strip any other HTML tags
    .replace(/[*_~`#>-]/g, '')             // strip common markdown symbols
    .replace(/\s+/g, ' ')
    .trim();
  return stripped; // empty string if the note is images-only
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
  const [copiedNoteId, setCopiedNoteId] = useState<string | null>(null);
  const [isUploading, setIsUploading] = useState(false);
  const [isDownloadingPdf, setIsDownloadingPdf] = useState(false);
  const [lightboxUrl, setLightboxUrl] = useState<string | null>(null);
  const debounceTimerRef = useRef<NodeJS.Timeout | null>(null);
  const noteEditorRef = useRef<NoteEditorRef>(null);
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
            isArchived: row.is_archived || false
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

  const handleDelete = async (e: React.MouseEvent, id: string) => {
    e.stopPropagation();
    if (confirm('Delete this entry?')) {
      const noteToDelete = notes.find(n => n.id === id);
      
      const newNotes = notes.filter((note) => note.id !== id);
      setNotes(newNotes);
      if (activeNoteId === id) {
        setActiveNoteId(null);
      }
      
      if (noteToDelete && noteToDelete.body) {
        const imgRegex = /!\[.*?\]\(([^\s)]+)/g;
        let match;
        const urls = [];
        while ((match = imgRegex.exec(noteToDelete.body)) !== null) {
          urls.push(match[1]);
        }
        
        if (urls.length > 0) {
          const pathsToRemove = urls.map(url => {
            const parts = url.split('/note-images/');
            return parts.length > 1 ? parts[1] : null;
          }).filter(Boolean) as string[];
          
          if (pathsToRemove.length > 0) {
            supabase.storage.from('note-images').remove(pathsToRemove).then(({ error }) => {
              if (error) console.error('Failed to delete images:', error);
            });
          }
        }
      }
      
      supabase.from('quick_notes').delete().eq('id', id).then(({error}) => {
        if (error) console.error('Failed to delete note', error);
      });
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

  const handleCopyNote = async (note: QuickNote) => {
    const fullText = note.title ? `${note.title}\n\n${note.body}` : note.body;
    try {
      if (navigator.clipboard) {
        await navigator.clipboard.writeText(fullText);
      } else {
        const textarea = document.createElement('textarea');
        textarea.value = fullText;
        document.body.appendChild(textarea);
        textarea.select();
        document.execCommand('copy');
        document.body.removeChild(textarea);
      }
      setCopiedNoteId(note.id);
      setTimeout(() => setCopiedNoteId(null), 2000);
    } catch (err) {
      console.error('Failed to copy note text:', err);
    }
  };

  const handleFileUpload = async (files: FileList | File[], noteId: string) => {
    if (!session?.user?.id) return;
    
    const imageFiles = Array.from(files).filter(f => f.type.startsWith('image/'));
    if (imageFiles.length === 0) return;

    setIsUploading(true);
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
      noteEditorRef.current?.insertImage(publicUrl);
    }
    
    setIsUploading(false);
    if (fileInputRef.current) fileInputRef.current.value = '';
  };
  
  const handleDownloadPdf = async () => {
    if (!activeNote || !noteEditorRef.current) return;
    
    setIsDownloadingPdf(true);
    try {
      const htmlContent = noteEditorRef.current.getHTML();
      const title = activeNote.title || 'Untitled Note';
      
      // Dynamic import to avoid blowing up initial bundle size
      const html2pdfModule = await import('html2pdf.js');
      // Fix for esm/cjs interop depending on how html2pdf.js is exported
      const html2pdf = (html2pdfModule.default ? html2pdfModule.default : html2pdfModule) as any;

      // Recreate the light/print-friendly HTML template
      const printContainer = document.createElement('div');
      printContainer.innerHTML = `
        <div style="font-family: 'Plus Jakarta Sans', -apple-system, BlinkMacSystemFont, 'Segoe UI', Helvetica, Arial, sans-serif; color: #1a1a1a; line-height: 1.6; font-size: 14px; padding: 20px;">
          <h1 style="font-family: 'Fraunces', Georgia, serif; font-style: italic; font-size: 32px; margin-bottom: 24px; border-bottom: 2px solid #e5e5e5; padding-bottom: 8px;">
            ${title}
          </h1>
          <div class="prose" style="max-width: none;">
            ${htmlContent}
          </div>
        </div>
      `;

      // Apply basic styles to ensure html2canvas captures them
      const styleBlock = document.createElement('style');
      styleBlock.innerHTML = `
        .prose img { max-width: 100%; height: auto; border-radius: 8px; margin: 16px 0; box-shadow: 0 4px 12px rgba(0,0,0,0.1); }
        .prose ul, .prose ol { padding-left: 24px; }
        .prose .tiptap-task-list { list-style: none; padding-left: 0; }
        .prose .tiptap-task-item { display: flex; align-items: flex-start; gap: 8px; margin-bottom: 8px; }
        .prose .tiptap-task-item input[type="checkbox"] { margin-top: 4px; width: 16px; height: 16px; accent-color: #FF5C38; }
        .prose .tiptap-task-item[data-checked="true"] > div { text-decoration: line-through; color: #888; }
        .prose pre { background: #f6f8fa; padding: 16px; border-radius: 8px; overflow-x: auto; border: 1px solid #e5e5e5; }
        .prose code { font-family: 'Space Mono', monospace; background: #f6f8fa; padding: 2px 4px; border-radius: 4px; font-size: 0.9em; }
        .prose blockquote { border-left: 4px solid #e5e5e5; padding-left: 16px; color: #555; margin-left: 0; font-style: italic; }
        .prose p { margin-top: 0; margin-bottom: 1em; }
        .prose mark { background-color: rgba(255, 92, 56, 0.2); padding: 0 2px; border-radius: 2px; }
      `;
      printContainer.appendChild(styleBlock);

      // CRITICAL: Force crossorigin="anonymous" on all images to prevent html2canvas CORS tainting,
      // and append a cache-busting query parameter so the browser doesn't serve a non-CORS cached version.
      const images = printContainer.querySelectorAll('img');
      images.forEach(img => {
        img.setAttribute('crossOrigin', 'anonymous');
        if (img.src && !img.src.includes('?')) {
          img.src = img.src + '?nocache=' + Date.now();
        }
      });

      const filename = `${title.replace(/[^a-zA-Z0-9_-]/g, '_')}.pdf`;
      
      const opt = {
        margin:       15,
        filename:     filename,
        image:        { type: 'jpeg', quality: 0.98 },
        html2canvas:  { scale: 2, useCORS: true },
        jsPDF:        { unit: 'mm', format: 'a4', orientation: 'portrait' }
      };

      await html2pdf().set(opt).from(printContainer).save();

    } catch (err) {
      console.error('Error downloading PDF:', err);
      alert('Failed to download PDF. Please try again.');
    } finally {
      setIsDownloadingPdf(false);
    }
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    if (activeNoteId && e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      handleFileUpload(e.dataTransfer.files, activeNoteId);
    }
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
  };

  const handlePaste = (e: React.ClipboardEvent) => {
    if (activeNoteId && e.clipboardData.files && e.clipboardData.files.length > 0) {
      handleFileUpload(e.clipboardData.files, activeNoteId);
    }
  };

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
      
      <AppSidebar 
        activePath="/app/quick-notes" 
        isMobileMenuOpen={isMobileMenuOpen} 
        onCloseMenu={() => setIsMobileMenuOpen(false)} 
        session={session} 
        onNewNote={handleNewNote}
        hideProfile={isStyleSheetOpen}
      >
        <div className="px-4 md:px-5 pb-3 space-y-4 shrink-0">
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

        <div className="flex-1 overflow-y-auto px-4 pb-6 space-y-1 md:space-y-2 custom-scrollbar min-h-0">
          {notesLoading ? (
            <div className="flex justify-center p-4">
              <svg className="animate-spin h-5 w-5 text-muted-text" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
              </svg>
            </div>
          ) : notes.length === 0 ? (
            <div className="p-4 text-center text-sm text-muted-text glass-panel rounded-xl border border-white/10 border-dashed">
              No quick notes yet.
            </div>
          ) : filteredNotes.length === 0 ? (
            <div className="p-4 text-center text-sm text-muted-text glass-panel rounded-xl border border-white/10 border-dashed">
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
                className={`w-full text-left p-3 md:p-4 rounded-xl transition-all cursor-pointer border-l-2 group relative ${
                  activeNoteId === note.id
                    ? 'bg-primary-accent/5 border-primary-accent'
                    : 'hover:bg-white/5 border-transparent'
                }`}
              >
                <div className="pr-8">
                  <h3 className="font-serif italic font-bold text-lg md:text-xl text-primary-text truncate tracking-tight">
                    {note.title || 'Untitled'}
                  </h3>
                  <p className="text-xs md:text-sm text-muted-text truncate mt-1">
                    {getPreviewText(note.body) || 'No content'}
                  </p>
                </div>

                <div className="absolute right-2 top-1/2 -translate-y-1/2 opacity-0 group-hover:opacity-100 transition-opacity flex items-center gap-0.5">
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
                  <button
                    type="button"
                    onClick={(e) => handleDelete(e, note.id)}
                    className="p-2 text-muted-text hover:text-red-400 hover:bg-background/50 rounded transition-colors"
                    title="Delete"
                  >
                    <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" viewBox="0 0 20 20" fill="currentColor">
                      <path fillRule="evenodd" d="M9 2a1 1 0 00-.894.553L7.382 4H4a1 1 0 000 2v10a2 2 0 002 2h8a2 2 0 002-2V6a1 1 0 100-2h-3.382l-.724-1.447A1 1 0 0011 2H9zM7 8a1 1 0 012 0v6a1 1 0 11-2 0V8zm5-1a1 1 0 00-1 1v6a1 1 0 102 0V8a1 1 0 00-1-1z" clipRule="evenodd" />
                    </svg>
                  </button>
                </div>
              </div>
            ))
          )}
        </div>
      </AppSidebar>

      {/* Main Content */}
      <main className="flex-1 overflow-y-auto flex flex-col w-full min-w-0">
        
        {/* Mobile Header */}
        <AppMobileHeader 
          onOpenMenu={() => setIsMobileMenuOpen(true)} 
          rightContent={
            saveState !== 'idle' ? (
              <span className="text-xs font-mono text-muted-text/60">
                {saveState === 'saving' ? 'Saving...' : 'Saved'}
              </span>
            ) : null
          }
        />

        <div className="flex-1 flex flex-col items-center relative z-0">
          
          {/* Ambient Glows */}
          <div className="absolute inset-0 pointer-events-none z-[-1] overflow-hidden flex items-center justify-center">
            <div className="absolute top-1/4 left-1/2 -translate-x-1/2 w-[600px] md:w-[800px] h-[600px] md:h-[800px] bg-[radial-gradient(circle_at_center,rgba(255,92,56,0.12)_0%,transparent_60%)]" />
            <div className="absolute top-1/3 left-1/3 w-[500px] h-[500px] bg-[radial-gradient(circle_at_center,rgba(255,143,119,0.08)_0%,transparent_60%)] mix-blend-screen" />
          </div>

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
            <div className="w-full max-w-4xl px-4 md:px-8 py-6 md:py-10 space-y-6 relative">
              
              {/* Page Header */}
              <div className="w-full flex flex-row items-end justify-between mb-2">
                <div>
                  <h1 className="font-serif italic font-bold text-4xl text-primary-text tracking-tight mb-2">Quick Notes</h1>
                  <p className="text-muted-text text-sm">Capture thoughts, tasks, and ideas</p>
                </div>
                <button 
                  onClick={handleNewNote}
                  className="px-4 py-3 md:py-2.5 rounded-xl bg-white/[0.03] hover:bg-white/[0.08] backdrop-blur-md border border-white/10 shadow-lg text-primary-text transition-all text-[15px] md:text-sm font-medium flex items-center gap-2 active:scale-95"
                >
                  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" /></svg>
                  <span className="hidden sm:inline">New note</span>
                </button>
              </div>

              <div 
                className="w-full bg-white/[0.045] backdrop-blur-[28px] rounded-[24px] overflow-hidden shadow-[0_20px_50px_rgba(0,0,0,0.4)] border-[0.5px] border-white/[0.09] transition-colors"
                onDrop={handleDrop}
                onDragOver={handleDragOver}
              >
                <div className="p-5 md:p-8 lg:p-12">
                  <div className="flex items-center justify-between mb-8 w-full">
                    <div className="flex items-center gap-3">
                      <span className="font-mono text-[10px] tracking-widest uppercase px-2 py-1 rounded bg-tertiary-accent/10 text-tertiary-accent flex items-center gap-1.5 font-bold shrink-0">
                        <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" /></svg>
                        <span className="hidden sm:inline">QUICK NOTE</span>
                        <span className="sm:hidden">NOTE</span>
                      </span>
                      {saveState && saveState !== 'idle' && (
                        <span className={`font-mono text-[10px] tracking-wide ${saveState === 'saving' ? 'text-amber-500/70' : 'text-[#8A9A5B]'}`}>
                          {saveState === 'saving' ? 'Saving...' : 'Saved'}
                        </span>
                      )}
                    </div>
                    
                    <div className="flex items-center gap-1">
                      {/* Minimal Font Controls - Hidden on mobile */}
                      <div className="hidden md:flex items-center gap-1 p-1 bg-white/5 border border-white/10 rounded-lg">
                        <select
                          value={activeNote.fontFamily}
                          onChange={(e) => handleUpdate(activeNote.id, { fontFamily: e.target.value })}
                          className="bg-transparent text-[13px] text-primary-text outline-none cursor-pointer border-none pl-1.5 pr-0.5"
                        >
                          <option value="Plus Jakarta Sans" className="bg-[#1A1714]">Sans</option>
                          <option value="Fraunces" className="bg-[#1A1714]">Serif</option>
                          <option value="Space Mono" className="bg-[#1A1714]">Mono</option>
                        </select>
                        <div className="w-px h-3.5 bg-hairline mx-1" />
                        <select
                          value={activeNote.fontSize}
                          onChange={(e) => handleUpdate(activeNote.id, { fontSize: e.target.value })}
                          className="bg-transparent text-[13px] text-primary-text outline-none cursor-pointer border-none pl-1.5 pr-0.5"
                        >
                          <option value="13px" className="bg-[#1A1714]">S</option>
                          <option value="15px" className="bg-[#1A1714]">M</option>
                          <option value="17px" className="bg-[#1A1714]">L</option>
                          <option value="20px" className="bg-[#1A1714]">XL</option>
                        </select>
                      </div>

                      {/* Toolbar Actions - Unified Row */}
                      <div className="flex items-center gap-0.5 bg-white/5 border border-white/10 rounded-lg p-1">
                        <button
                          type="button"
                          onClick={() => noteEditorRef.current?.insertChecklist()}
                          className="p-1.5 md:p-1 rounded text-muted-text hover:text-primary-text hover:bg-white/5 transition-colors"
                          title="Checklist"
                        >
                          <svg className="w-4 h-4 md:w-3.5 md:h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                            <polyline points="9 11 12 14 22 4"></polyline>
                            <path d="M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11"></path>
                          </svg>
                        </button>
                        <button
                          type="button"
                          onClick={() => fileInputRef.current?.click()}
                          className="p-1.5 md:p-1 rounded text-muted-text hover:text-primary-text hover:bg-white/5 transition-colors"
                          title="Add Image"
                        >
                          <svg xmlns="http://www.w3.org/2000/svg" className="w-4 h-4 md:w-3.5 md:h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                          </svg>
                        </button>
                        <button
                          type="button"
                          onClick={() => handleCopyNote(activeNote)}
                          className={`p-1.5 md:p-1 rounded transition-colors ${copiedNoteId === activeNote.id ? 'text-[#8A9A5B] bg-[#8A9A5B]/10' : 'text-muted-text hover:text-primary-text hover:bg-white/5'}`}
                          title={copiedNoteId === activeNote.id ? "Copied!" : "Copy Note to Clipboard"}
                        >
                          {copiedNoteId === activeNote.id ? (
                            <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 md:h-3.5 md:w-3.5" viewBox="0 0 20 20" fill="currentColor">
                              <path d="M9 2a1 1 0 000 2h2a1 1 0 100-2H9z" />
                              <path fillRule="evenodd" d="M4 5a2 2 0 012-2 3 3 0 003 3h2a3 3 0 003-3 2 2 0 012 2v11a2 2 0 01-2 2H6a2 2 0 01-2-2V5zm9.707 5.707a1 1 0 00-1.414-1.414L9 12.586l-1.293-1.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                            </svg>
                          ) : (
                            <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 md:h-3.5 md:w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 5H6a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2v-1M8 5a2 2 0 002 2h2a2 2 0 002-2M8 5a2 2 0 012-2h2a2 2 0 012 2m0 0h2a2 2 0 012 2v3m2 4H10m0 0l3-3m-3 3l3 3" />
                            </svg>
                          )}
                        </button>
                        
                        <div className="hidden md:block w-px h-4 bg-white/10 mx-1" />
                        
                        <button
                          type="button"
                          onClick={handleDownloadPdf}
                          disabled={isDownloadingPdf}
                          className="hidden md:flex p-1.5 md:p-1 rounded text-muted-text hover:text-primary-text hover:bg-white/5 transition-colors disabled:opacity-50"
                          title="Download PDF"
                        >
                          {isDownloadingPdf ? (
                            <svg className="animate-spin w-4 h-4 md:w-3.5 md:h-3.5" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                            </svg>
                          ) : (
                            <svg xmlns="http://www.w3.org/2000/svg" className="w-4 h-4 md:w-3.5 md:h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
                            </svg>
                          )}
                        </button>
                        
                        <button
                          type="button"
                          onClick={(e) => handleArchiveToggle(e, activeNote.id, !!activeNote.isArchived)}
                          className="hidden md:flex p-1.5 md:p-1 rounded text-muted-text hover:text-red-400 hover:bg-red-500/10 transition-colors"
                          title={activeNote.isArchived ? "Unarchive" : "Archive Note"}
                        >
                          {activeNote.isArchived ? (
                            <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 md:h-3.5 md:w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 10h10a8 8 0 018 8v2M3 10l6 6m-6-6l6-6" />
                            </svg>
                          ) : (
                            <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 md:h-3.5 md:w-3.5" viewBox="0 0 20 20" fill="currentColor">
                              <path d="M4 3a2 2 0 100 4h12a2 2 0 100-4H4z" />
                              <path fillRule="evenodd" d="M3 8h14v7a2 2 0 01-2 2H5a2 2 0 01-2-2V8zm5 3a1 1 0 011-1h2a1 1 0 110 2H9a1 1 0 01-1-1z" clipRule="evenodd" />
                            </svg>
                          )}
                        </button>

                        <input 
                          type="file" 
                          ref={fileInputRef} 
                          hidden 
                          accept="image/*" 
                          multiple 
                          onChange={(e) => {
                            if (e.target.files && activeNoteId) {
                              handleFileUpload(e.target.files, activeNoteId);
                            }
                          }}
                        />
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


                  <NoteEditor
                    ref={noteEditorRef}
                    value={activeNote.body}
                    onChange={(newVal) => handleUpdate(activeNote.id, { body: newVal })}
                    placeholder="Write your note here..."
                    style={{
                      fontFamily: `var(--font-${activeNote.fontFamily.toLowerCase().replace(/ /g, '-')}), ${activeNote.fontFamily}, sans-serif`,
                      fontSize: activeNote.fontSize,
                      textAlign: activeNote.textAlign as any,
                      fontWeight: activeNote.isBold ? 'bold' : 'normal',
                      fontStyle: activeNote.isItalic ? 'italic' : 'normal',
                      textDecoration: activeNote.isUnderline ? 'underline' : 'none'
                    }}
                    className="w-full text-muted-text hover:text-primary-text focus-within:text-primary-text min-h-[120px] transition-colors leading-relaxed"
                    onPaste={handlePaste}
                  />

                  {isUploading && (
                    <div className="mt-6 pt-4 border-t border-hairline/50 flex justify-center">
                      <div className="w-8 h-8 flex items-center justify-center animate-pulse">
                        <svg className="animate-spin h-5 w-5 text-muted-text" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                        </svg>
                      </div>
                    </div>
                  )}
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
            className="md:hidden fixed bottom-6 right-6 w-14 h-14 glass-panel border border-white/10 rounded-full shadow-[0_8px_32px_rgba(0,0,0,0.3)] flex items-center justify-center text-primary-text hover:bg-white/10 transition-colors z-30 backdrop-blur-xl"
          >
            <span className="font-serif italic font-bold text-xl leading-none">Aa</span>
          </button>
        )}

        {/* Mobile Bottom Sheet */}
        {isStyleSheetOpen && activeNote && (
          <>
            <div 
              className="fixed inset-0 bg-black/60 backdrop-blur-sm z-[100] md:hidden"
              onClick={() => setIsStyleSheetOpen(false)}
            />
            <div className="fixed bottom-0 left-0 right-0 glass-panel-modal border-t border-white/10 rounded-t-[32px] p-6 z-[101] md:hidden animate-in slide-in-from-bottom shadow-[0_-8px_40px_rgba(0,0,0,0.4)] safe-area-pb pb-8">
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
                        className={`p-2.5 rounded-xl text-sm border transition-all ${activeNote.fontFamily === font ? 'bg-primary-accent/10 border-primary-accent text-primary-accent' : 'border-white/10 text-muted-text glass-panel-subtle hover:bg-white/10'}`}
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
                        className={`p-2.5 rounded-xl text-sm border transition-all ${activeNote.fontSize === size ? 'bg-primary-accent/10 border-primary-accent text-primary-accent' : 'border-white/10 text-muted-text glass-panel-subtle hover:bg-white/10'}`}
                      >
                        {size.replace('px', '')}
                      </button>
                    ))}
                  </div>
                </div>

                <div>
                  <h4 className="text-xs font-mono tracking-wider text-muted-text uppercase mb-3">Actions</h4>
                  <div className="grid grid-cols-4 gap-2">
                    <button
                      type="button"
                      onClick={() => {
                        noteEditorRef.current?.insertChecklist();
                        setIsStyleSheetOpen(false);
                      }}
                      className="p-2.5 rounded-xl flex items-center justify-center border border-white/10 text-muted-text glass-panel-subtle hover:bg-white/10 transition-all"
                      title="Checklist"
                    >
                      <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                        <polyline points="9 11 12 14 22 4"></polyline>
                        <path d="M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11"></path>
                      </svg>
                    </button>
                    
                    <button
                      type="button"
                      onClick={() => {
                        fileInputRef.current?.click();
                        setIsStyleSheetOpen(false);
                      }}
                      className="p-2.5 rounded-xl flex items-center justify-center border border-white/10 text-muted-text glass-panel-subtle hover:bg-white/10 transition-all"
                      title="Add Image"
                    >
                      <svg xmlns="http://www.w3.org/2000/svg" className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                      </svg>
                    </button>

                    <button
                      type="button"
                      onClick={() => {
                        handleCopyNote(activeNote);
                        setIsStyleSheetOpen(false);
                      }}
                      className={`p-2.5 rounded-xl flex items-center justify-center border transition-all ${copiedNoteId === activeNote.id ? 'bg-[#8A9A5B]/10 border-[#8A9A5B]/30 text-[#8A9A5B]' : 'border-white/10 text-muted-text glass-panel-subtle hover:bg-white/10'}`}
                      title="Copy Note"
                    >
                      {copiedNoteId === activeNote.id ? (
                        <svg className="w-4 h-4 text-[#8A9A5B]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                          <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                        </svg>
                      ) : (
                        <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
                          <rect x="9" y="9" width="13" height="13" rx="2" ry="2"></rect>
                          <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"></path>
                        </svg>
                      )}
                    </button>
                    
                    <button
                      type="button"
                      onClick={(e) => {
                        handleArchiveToggle(e, activeNote.id, !!activeNote.isArchived);
                        setIsStyleSheetOpen(false);
                      }}
                      className={`p-2.5 rounded-xl flex items-center justify-center border transition-all ${activeNote.isArchived ? 'bg-red-500/10 border-red-500/30 text-red-400' : 'border-white/10 text-muted-text glass-panel-subtle hover:bg-white/10 hover:text-red-400'}`}
                      title={activeNote.isArchived ? "Unarchive" : "Archive Note"}
                    >
                      {activeNote.isArchived ? (
                        <svg xmlns="http://www.w3.org/2000/svg" className="w-4 h-4 text-red-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 10h10a8 8 0 018 8v2M3 10l6 6m-6-6l6-6" />
                        </svg>
                      ) : (
                        <svg xmlns="http://www.w3.org/2000/svg" className="w-4 h-4" viewBox="0 0 20 20" fill="currentColor">
                          <path d="M4 3a2 2 0 100 4h12a2 2 0 100-4H4z" />
                          <path fillRule="evenodd" d="M3 8h14v7a2 2 0 01-2 2H5a2 2 0 01-2-2V8zm5 3a1 1 0 011-1h2a1 1 0 110 2H9a1 1 0 01-1-1z" clipRule="evenodd" />
                        </svg>
                      )}
                    </button>
                    
                    <button
                      type="button"
                      onClick={() => {
                        handleDownloadPdf();
                        setIsStyleSheetOpen(false);
                      }}
                      disabled={isDownloadingPdf}
                      className="p-2.5 rounded-xl flex items-center justify-center border border-white/10 text-muted-text glass-panel-subtle hover:bg-white/10 transition-all disabled:opacity-50"
                      title="Download PDF"
                    >
                      <svg xmlns="http://www.w3.org/2000/svg" className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
                      </svg>
                    </button>
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
