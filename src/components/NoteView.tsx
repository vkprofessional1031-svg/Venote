'use client';

import React, { useState, useRef, useEffect } from 'react';

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
}

export default function NoteView({ title, body, embeddedTasks = [], onToggle, onUpdate }: NoteViewProps) {
  const [editingTitle, setEditingTitle] = useState(false);
  const [titleText, setTitleText] = useState(title);
  
  const [editingBody, setEditingBody] = useState(false);
  const [bodyText, setBodyText] = useState(body);

  const [editingIndex, setEditingIndex] = useState<number | null>(null);
  const [editingText, setEditingText] = useState('');
  const [newItemText, setNewItemText] = useState('');
  const [toastMessage, setToastMessage] = useState<string | null>(null);
  
  const titleInputRef = useRef<HTMLInputElement>(null);
  const bodyInputRef = useRef<HTMLTextAreaElement>(null);
  const editInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (editingTitle && titleInputRef.current) titleInputRef.current.focus();
  }, [editingTitle]);

  useEffect(() => {
    if (editingBody && bodyInputRef.current) {
      bodyInputRef.current.focus();
      bodyInputRef.current.style.height = 'auto';
      bodyInputRef.current.style.height = bodyInputRef.current.scrollHeight + 'px';
    }
  }, [editingBody, bodyText]);

  useEffect(() => {
    if (editingIndex !== null && editInputRef.current) editInputRef.current.focus();
  }, [editingIndex]);

  const handleToggle = (index: number) => {
    if (onToggle) onToggle(index);
  };

  const saveTitle = () => {
    if (onUpdate && titleText.trim() && titleText !== title) {
      onUpdate({ type: 'note', title: titleText, body, embeddedTasks });
    }
    setEditingTitle(false);
  };

  const saveBody = () => {
    if (onUpdate && bodyText.trim() && bodyText !== body) {
      onUpdate({ type: 'note', title, body: bodyText, embeddedTasks });
    }
    setEditingBody(false);
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
      console.error('Failed to share', err);
    }
  };

  return (
    <div className="w-full bg-card rounded-[24px] border border-hairline overflow-hidden shadow-2xl">
      <div className="p-6 md:p-8 lg:p-10">
        <div className="flex items-center justify-between mb-6 md:mb-8 relative">
          <span className="font-mono text-[10px] tracking-widest uppercase px-2 py-1 rounded bg-tertiary-accent/10 text-tertiary-accent flex items-center gap-1.5 font-bold">
            <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" /></svg>
            NOTE
          </span>
          <div className="flex items-center gap-1">
            <button 
              onClick={handleShare}
              className="p-2 text-muted-text hover:text-tertiary-accent transition-colors rounded-lg bg-background/50 hover:bg-background"
              title="Share card"
            >
              <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" viewBox="0 0 20 20" fill="currentColor">
                <path d="M15 8a3 3 0 10-2.977-2.63l-4.94 2.47a3 3 0 100 4.319l4.94 2.47a3 3 0 10.895-1.789l-4.94-2.47a3.027 3.027 0 000-.74l4.94-2.47C13.456 7.68 14.19 8 15 8z" />
              </svg>
            </button>
            <button 
              onClick={() => { setEditingTitle(true); setEditingBody(true); }}
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
        
        {editingTitle ? (
          <input
            ref={titleInputRef}
            type="text"
            value={titleText}
            onChange={(e) => setTitleText(e.target.value)}
            onBlur={saveTitle}
            onKeyDown={(e) => handleKeyDown(e, saveTitle, () => setEditingTitle(false))}
            className="w-full font-serif italic font-bold text-2xl md:text-4xl text-primary-text bg-background border border-primary-accent/50 rounded px-3 py-2 mb-6 md:mb-8 tracking-tight leading-snug outline-none"
          />
        ) : (
          <h2 
            onClick={() => setEditingTitle(true)}
            className="font-serif italic font-bold text-2xl md:text-4xl text-primary-text mb-6 md:mb-8 tracking-tight leading-snug cursor-text hover:text-white transition-colors inline-block"
          >
            {title}
          </h2>
        )}
        
        <div className="mb-10 group relative">
          {editingBody ? (
            <textarea
              ref={bodyInputRef}
              value={bodyText}
              onChange={(e) => {
                setBodyText(e.target.value);
                e.target.style.height = 'auto';
                e.target.style.height = e.target.scrollHeight + 'px';
              }}
              onBlur={saveBody}
              onKeyDown={(e) => handleKeyDown(e, saveBody, () => setEditingBody(false))}
              className="w-full font-sans text-primary-text text-lg leading-[1.8] bg-background border border-primary-accent/50 rounded p-4 outline-none resize-none overflow-hidden"
              rows={3}
            />
          ) : (
            <p 
              onClick={() => setEditingBody(true)}
              className="font-sans text-primary-text text-lg leading-[1.8] whitespace-pre-wrap cursor-text hover:text-white transition-colors p-4 -mx-4 rounded hover:bg-background/50"
            >
              {body}
            </p>
          )}
        </div>

        <div className="mt-10 pt-8 border-t border-hairline">
          <h3 className="font-mono text-xs font-bold text-muted-text uppercase tracking-widest mb-6">
            Related Tasks
          </h3>
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
      </div>
    </div>
  );
}
