'use client';

import React, { useState, useRef, useEffect } from 'react';
import { supabase } from '@/lib/supabase';

export interface EmbeddedTask {
  text: string;
  done: boolean;
}

export interface NoteViewProps {
  title: string;
  body: string;
  embeddedTasks?: EmbeddedTask[];
  onToggle?: (index: number) => void;
  onUpdate?: (data: any) => void;
  autoFocus?: boolean;
  headerAddon?: React.ReactNode;
  archiveButton?: React.ReactNode;
  saveState?: 'idle' | 'saving' | 'saved';
  imageUrls?: string[];
  onUpdateImages?: (urls: string[]) => void;
  uploadPathPrefix?: string;
}

export default function NoteView({ title, body, embeddedTasks = [], onToggle, onUpdate, autoFocus, headerAddon, saveState, archiveButton, imageUrls = [], onUpdateImages, uploadPathPrefix }: NoteViewProps) {
  const [titleText, setTitleText] = useState(title);
  const [bodyText, setBodyText] = useState(body);

  const [editingIndex, setEditingIndex] = useState<number | null>(null);
  const [editingText, setEditingText] = useState('');
  const [newItemText, setNewItemText] = useState('');
  const [toastMessage, setToastMessage] = useState<string | null>(null);
  
  const [isUploading, setIsUploading] = useState(false);
  const [lightboxUrl, setLightboxUrl] = useState<string | null>(null);
  
  const titleInputRef = useRef<HTMLInputElement>(null);
  const bodyInputRef = useRef<HTMLTextAreaElement>(null);
  const editInputRef = useRef<HTMLInputElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (bodyInputRef.current) {
      if (autoFocus && !bodyText) {
        bodyInputRef.current.focus();
      }
      bodyInputRef.current.style.height = 'auto';
      bodyInputRef.current.style.height = bodyInputRef.current.scrollHeight + 'px';
    }
  }, [bodyText, autoFocus]);

  useEffect(() => {
    if (editingIndex !== null && editInputRef.current) editInputRef.current.focus();
  }, [editingIndex]);

  const handleToggle = (index: number) => {
    if (onToggle) onToggle(index);
  };

  const saveTaskEdit = () => {
    if (editingIndex !== null && onUpdate) {
      const newItems = [...embeddedTasks];
      if (editingText.trim()) {
        newItems[editingIndex] = { ...newItems[editingIndex], text: editingText };
      }
      onUpdate({ type: 'note', title, body, embeddedTasks: newItems });
    }
    setEditingIndex(null);
  };

  const handleKeyDown = (e: React.KeyboardEvent, action: () => void, cancelAction: () => void) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      action();
    } else if (e.key === 'Escape') {
      cancelAction();
    }
  };

  const removeTask = (e: React.MouseEvent, index: number) => {
    e.stopPropagation();
    if (onUpdate) {
      const newItems = embeddedTasks.filter((_, i) => i !== index);
      onUpdate({ type: 'note', title, body, embeddedTasks: newItems });
    }
  };

  const addTask = () => {
    if (newItemText.trim() && onUpdate) {
      const newItems = [...embeddedTasks, { text: newItemText, done: false }];
      onUpdate({ type: 'note', title, body, embeddedTasks: newItems });
      setNewItemText('');
    }
  };

  const handleShare = async () => {
    let text = `${title}\n\n${body}`;
    if (embeddedTasks && embeddedTasks.length > 0) {
      text += '\n\n' + embeddedTasks.map(t => `[${t.done ? 'x' : ' '}] ${t.text}`).join('\n');
    }
    
    try {
      if (navigator.share) {
        await navigator.share({ text });
      } else {
        await navigator.clipboard.writeText(text);
        setToastMessage('Copied to clipboard');
        setTimeout(() => setToastMessage(null), 3000);
      }
    } catch (err) {
      console.error('Failed to share:', err);
    }
  };

  const handleFileUpload = async (files: FileList | File[]) => {
    if (!uploadPathPrefix || !onUpdateImages) return;
    
    const imageFiles = Array.from(files).filter(f => f.type.startsWith('image/'));
    if (imageFiles.length === 0) return;

    setIsUploading(true);
    const newUrls = [...imageUrls];

    for (const file of imageFiles) {
      if (file.size > 10 * 1024 * 1024) {
        setToastMessage('File too large. Max 10MB.');
        setTimeout(() => setToastMessage(null), 3000);
        continue;
      }
      
      const fileName = `${Date.now()}_${file.name.replace(/[^a-zA-Z0-9.-]/g, '_')}`;
      const filePath = `${uploadPathPrefix}/${fileName}`;

      const { error: uploadError } = await supabase.storage
        .from('note-images')
        .upload(filePath, file);

      if (uploadError) {
        console.error('Upload failed:', uploadError);
        setToastMessage('Upload failed');
        setTimeout(() => setToastMessage(null), 3000);
        continue;
      }

      const { data: { publicUrl } } = supabase.storage
        .from('note-images')
        .getPublicUrl(filePath);
        
      newUrls.push(publicUrl);
    }

    if (newUrls.length > imageUrls.length) {
      onUpdateImages(newUrls);
    }
    
    setIsUploading(false);
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const handleDeleteImage = async (e: React.MouseEvent, urlToRemove: string) => {
    e.stopPropagation();
    if (!onUpdateImages) return;

    try {
      const urlObj = new URL(urlToRemove);
      const parts = urlObj.pathname.split('/note-images/');
      if (parts.length > 1) {
        const filePath = parts[1];
        await supabase.storage.from('note-images').remove([filePath]);
      }
    } catch (err) {
      console.error('Failed to parse URL for deletion', err);
    }

    onUpdateImages(imageUrls.filter(u => u !== urlToRemove));
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      handleFileUpload(e.dataTransfer.files);
    }
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
  };

  const handlePaste = (e: React.ClipboardEvent) => {
    if (e.clipboardData.files && e.clipboardData.files.length > 0) {
      handleFileUpload(e.clipboardData.files);
    }
  };

  return (
    <>
      <div 
        className="w-full bg-card rounded-[24px] overflow-hidden shadow-sm border border-transparent transition-colors"
        onDrop={handleDrop}
        onDragOver={handleDragOver}
      >
        <div className="p-4 md:p-6 lg:p-8">
        <div className="flex flex-col md:flex-row md:items-center justify-between mb-4 md:mb-6 gap-3 md:gap-0 relative">
          <div className="flex items-center gap-3 flex-wrap">
            <span className="font-mono text-[10px] tracking-widest uppercase px-2 py-1 rounded bg-tertiary-accent/10 text-tertiary-accent flex items-center gap-1.5 font-bold shrink-0">
              <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" /></svg>
              NOTE
            </span>
            {headerAddon}
          </div>
          
          <div className="flex items-center gap-3 self-end md:self-auto shrink-0">
            {saveState && saveState !== 'idle' && (
              <span className={`font-mono text-[10px] tracking-wide ${saveState === 'saving' ? 'text-amber-500/70' : 'text-[#8A9A5B]'}`}>
                {saveState === 'saving' ? 'Saving...' : 'Saved'}
              </span>
            )}
            <div className="flex items-center gap-1">
              {archiveButton}
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                className="p-1.5 text-muted-text hover:text-primary-text hover:bg-white/5 rounded-lg transition-colors"
                title="Add Image"
              >
                <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
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
                  if (e.target.files) handleFileUpload(e.target.files);
                }}
              />
              <button
                type="button"
                onClick={handleShare}
                className="p-1.5 text-muted-text hover:text-primary-text hover:bg-white/5 rounded-lg transition-colors"
                title="Share"
              >
                <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8.684 13.342C8.886 12.938 9 12.482 9 12c0-.482-.114-.938-.316-1.342m0 2.684a3 3 0 110-2.684m0 2.684l6.632 3.316m-6.632-6l6.632-3.316m0 0a3 3 0 105.367-2.684 3 3 0 00-5.367 2.684zm0 9.316a3 3 0 105.368 2.684 3 3 0 00-5.368-2.684z" />
                </svg>
              </button>
            </div>
            <button
              type="button" 
              onClick={() => { bodyInputRef.current?.focus(); }}
              className="p-2 text-muted-text hover:text-primary-text transition-colors rounded-lg bg-background/50 hover:bg-background"
              title="Edit card"
            >
              <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" viewBox="0 0 20 20" fill="currentColor">
                <path d="M13.586 3.586a2 2 0 112.828 2.828l-.793.793-2.828-2.828.793-.793zM11.379 5.793L3 14.172V17h2.828l8.38-8.379-2.83-2.828z" />
              </svg>
            </button>
          </div>
          
          {toastMessage && (
            <div className="absolute top-full right-0 mt-2 px-3 py-1.5 bg-tertiary-accent text-card text-xs font-bold rounded shadow-lg z-10 transition-opacity">
              {toastMessage}
            </div>
          )}
        </div>
        
        <input
          ref={titleInputRef}
          type="text"
          value={titleText}
          placeholder="Note title..."
          onChange={(e) => {
            setTitleText(e.target.value);
            if (onUpdate) onUpdate({ type: 'note', title: e.target.value, body, embeddedTasks });
          }}
          className="w-full font-serif italic font-bold text-2xl md:text-3xl text-primary-text bg-transparent border-none px-0 py-1 mb-4 md:mb-6 tracking-tight leading-snug outline-none placeholder:text-muted-text/30"
        />
        <div className="mb-6 group relative">
          <textarea
            ref={bodyInputRef}
            value={bodyText}
            placeholder="Start typing your note..."
            onPaste={handlePaste}
            onDrop={handleDrop}
            onDragOver={handleDragOver}
            onChange={(e) => {
              setBodyText(e.target.value);
              e.target.style.height = 'auto';
              e.target.style.height = e.target.scrollHeight + 'px';
              if (onUpdate) onUpdate({ type: 'note', title: titleText, body: e.target.value, embeddedTasks });
            }}
            className="w-full font-sans text-primary-text leading-[1.8] bg-transparent border-none p-0 outline-none resize-none overflow-hidden placeholder:text-muted-text/30"
            rows={1}
          />
        </div>

        <div className="mt-8">
            <ul className="space-y-2">
              {embeddedTasks?.map((task, index) => (
                <li key={index} className="group/task relative">
                  <label className="flex items-start gap-4 p-4 -mx-4 md:p-3 md:-mx-3 rounded-xl hover:bg-background cursor-pointer transition-colors group/label">
                    <div className="relative flex items-center justify-center pt-0.5 md:pt-1 shrink-0">
                      <input
                        type="checkbox"
                        checked={task.done}
                        onChange={() => handleToggle(index)}
                        className="w-5 h-5 cursor-pointer appearance-none rounded border-2 border-muted-text/50 checked:border-primary-accent checked:bg-primary-accent transition-all peer focus:ring-2 focus:ring-primary-accent/30 focus:ring-offset-0 focus:outline-none bg-transparent"
                      />
                      <span className="pointer-events-none absolute top-[6px] text-card opacity-0 peer-checked:opacity-100 transition-opacity">
                        <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="4" strokeLinecap="round" strokeLinejoin="round">
                          <polyline points="20 6 9 17 4 12" />
                        </svg>
                      </span>
                    </div>
                    {editingIndex === index ? (
                      <input
                        ref={editInputRef}
                        type="text"
                        value={editingText}
                        onChange={(e) => setEditingText(e.target.value)}
                        onBlur={saveTaskEdit}
                        onKeyDown={(e) => handleKeyDown(e, saveTaskEdit, () => setEditingIndex(null))}
                        onClick={(e) => e.stopPropagation()}
                        className="flex-1 font-sans text-lg text-primary-text bg-background border border-primary-accent/50 rounded px-2 py-0 outline-none -ml-2 -mt-0.5"
                      />
                    ) : (
                      <span
                        onClick={(e) => {
                          e.preventDefault();
                          setEditingIndex(index);
                          setEditingText(task.text);
                        }}
                        className={`flex-1 font-sans text-lg leading-relaxed select-none transition-all duration-200 pt-0.5 pr-8 ${
                          task.done ? 'text-muted-text line-through' : 'text-primary-text group-hover/label:text-white cursor-text'
                        }`}
                      >
                        {task.text}
                      </span>
                    )}
                  </label>
                  <div className="absolute right-0 top-0 bottom-0 flex items-center pr-2 md:-mr-3 opacity-100 md:opacity-0 md:group-hover/task:opacity-100 transition-opacity">
                    <button
                      type="button"
                      onClick={(e) => removeTask(e, index)}
                      className="p-3 md:p-2 text-muted-text hover:text-red-400 rounded transition-colors"
                      title="Remove item"
                    >
                      <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 md:h-4 md:w-4" viewBox="0 0 20 20" fill="currentColor">
                        <path fillRule="evenodd" d="M9 2a1 1 0 00-.894.553L7.382 4H4a1 1 0 000 2v10a2 2 0 002 2h8a2 2 0 002-2V6a1 1 0 100-2h-3.382l-.724-1.447A1 1 0 0011 2H9zM7 8a1 1 0 012 0v6a1 1 0 11-2 0V8zm5-1a1 1 0 00-1 1v6a1 1 0 102 0V8a1 1 0 00-1-1z" clipRule="evenodd" />
                      </svg>
                    </button>
                  </div>
                </li>
              ))}
            </ul>

            <div className="mt-4 flex items-center gap-4 px-0 md:px-1 relative">
              <div className="w-5 flex justify-center shrink-0">
                <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 text-muted-text/50" viewBox="0 0 20 20" fill="currentColor">
                  <path fillRule="evenodd" d="M10 3a1 1 0 011 1v5h5a1 1 0 110 2h-5v5a1 1 0 11-2 0v-5H4a1 1 0 110-2h5V4a1 1 0 011-1z" clipRule="evenodd" />
                </svg>
              </div>
              <input
                type="text"
                value={newItemText}
                onChange={(e) => setNewItemText(e.target.value)}
                onKeyDown={(e) => handleKeyDown(e, addTask, () => setNewItemText(''))}
                onBlur={() => { if (newItemText.trim()) addTask(); }}
                placeholder="Add new task..."
                className="flex-1 font-sans text-lg text-primary-text bg-transparent outline-none placeholder:text-muted-text/50 py-1"
              />
            </div>
          </div>
          
          {/* Image Thumbnails */}
          {(imageUrls.length > 0 || isUploading) && (
            <div className="px-4 md:px-6 lg:px-8 pb-4 md:pb-6 lg:pb-8 pt-0">
              <div className="flex flex-wrap gap-3 mt-2">
                {imageUrls.map((url, i) => (
                  <div key={i} className="relative group w-20 h-20 rounded-lg overflow-hidden border border-hairline bg-black/20 shrink-0">
                    <img 
                      src={url} 
                      alt="Attachment" 
                      className="w-full h-full object-cover cursor-pointer hover:opacity-90 transition-opacity" 
                      onClick={() => setLightboxUrl(url)}
                    />
                    <button
                      type="button"
                      onClick={(e) => handleDeleteImage(e, url)}
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
          )}
        </div>
      </div>
      
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
    </>
  );
}
