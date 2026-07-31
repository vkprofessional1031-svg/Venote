'use client';

import React, { useRef, useEffect, useImperativeHandle, forwardRef, useState } from 'react';

interface NoteEditorProps {
  value: string;
  onChange: (val: string) => void;
  style?: React.CSSProperties;
  className?: string;
  placeholder?: string;
  onPaste?: (e: React.ClipboardEvent) => void;
}

export interface NoteEditorRef {
  insertChecklist: () => void;
}

const AutoResizeTextarea = ({ value, onChange, onKeyDown, onFocus, style, className, placeholder }: any) => {
  const ref = useRef<HTMLTextAreaElement>(null);
  
  useEffect(() => {
    if (ref.current) {
      ref.current.style.height = '0px';
      ref.current.style.height = `${ref.current.scrollHeight}px`;
    }
  }, [value]);

  return (
    <textarea
      ref={ref}
      value={value}
      onChange={(e) => {
        onChange(e.target.value);
      }}
      onKeyDown={onKeyDown}
      onFocus={onFocus}
      placeholder={placeholder}
      className={`resize-none overflow-hidden outline-none bg-transparent ${className || ''}`}
      style={style}
      rows={1}
    />
  );
};

export const NoteEditor = forwardRef<NoteEditorRef, NoteEditorProps>(({ value, onChange, style, className, placeholder, onPaste }, ref) => {
  const lines = value.split('\n');
  if (lines.length === 0) lines.push('');
  
  const [activeLineIndex, setActiveLineIndex] = useState<number>(0);
  const containerRef = useRef<HTMLDivElement>(null);

  useImperativeHandle(ref, () => ({
    insertChecklist: () => {
      const newLines = [...lines];
      const currentLine = newLines[activeLineIndex] || '';
      if (!currentLine.startsWith('- [ ] ') && !currentLine.startsWith('- [x] ')) {
        newLines[activeLineIndex] = `- [ ] ${currentLine}`;
        onChange(newLines.join('\n'));
        focusLine(activeLineIndex, 'end');
      }
    }
  }));

  const focusLine = (index: number, cursorPosition?: 'start' | 'end') => {
    setTimeout(() => {
      if (!containerRef.current) return;
      const textareas = containerRef.current.querySelectorAll('textarea');
      const target = textareas[index];
      if (target) {
        target.focus();
        if (cursorPosition === 'start') {
          target.selectionStart = 0;
          target.selectionEnd = 0;
        } else if (cursorPosition === 'end') {
          target.selectionStart = target.value.length;
          target.selectionEnd = target.value.length;
        }
      }
    }, 10);
  };

  const handleLineChange = (index: number, newText: string) => {
    const newLines = [...lines];
    newLines[index] = newText;
    onChange(newLines.join('\n'));
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>, index: number) => {
    const target = e.currentTarget;
    
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      const cursor = target.selectionStart;
      const text = lines[index];
      
      const isChecklist = text.startsWith('- [ ] ') || text.startsWith('- [x] ');
      const prefixLength = isChecklist ? 6 : 0;
      
      // If cursor is at the very beginning of a checklist item (before the text), behave differently
      const beforeCursorText = text.substring(prefixLength, prefixLength + cursor);
      const afterCursorText = text.substring(prefixLength + cursor);
      
      let nextLinePrefix = '';
      if (isChecklist) {
        nextLinePrefix = '- [ ] ';
        // If the current line is just an empty checklist, hitting enter should remove the checklist format
        if (text === '- [ ] ' || text === '- [x] ') {
          handleLineChange(index, '');
          return;
        }
      }

      const newLines = [...lines];
      
      if (isChecklist) {
        newLines[index] = text.substring(0, prefixLength) + target.value.substring(0, cursor);
        newLines.splice(index + 1, 0, nextLinePrefix + target.value.substring(cursor));
      } else {
        newLines[index] = target.value.substring(0, cursor);
        newLines.splice(index + 1, 0, target.value.substring(cursor));
      }
      
      onChange(newLines.join('\n'));
      setActiveLineIndex(index + 1);
      focusLine(index + 1, 'start');
    }
    else if (e.key === 'Backspace' && target.selectionStart === 0 && target.selectionEnd === 0) {
      const text = lines[index];
      // If it's a checklist, backspace removes the checklist format
      if (text.startsWith('- [ ] ') || text.startsWith('- [x] ')) {
        e.preventDefault();
        handleLineChange(index, text.substring(6));
        return;
      }
      
      // If it's normal text and not the first line, merge with previous line
      if (index > 0) {
        e.preventDefault();
        const prevLine = lines[index - 1];
        const prevLineLength = prevLine.startsWith('- [ ] ') || prevLine.startsWith('- [x] ') 
          ? prevLine.length - 6 
          : prevLine.length;
          
        const newLines = [...lines];
        newLines[index - 1] = newLines[index - 1] + newLines[index];
        newLines.splice(index, 1);
        onChange(newLines.join('\n'));
        setActiveLineIndex(index - 1);
        
        setTimeout(() => {
          if (!containerRef.current) return;
          const textareas = containerRef.current.querySelectorAll('textarea');
          const targetTA = textareas[index - 1];
          if (targetTA) {
            targetTA.focus();
            targetTA.selectionStart = prevLineLength;
            targetTA.selectionEnd = prevLineLength;
          }
        }, 10);
      }
    }
    else if (e.key === 'ArrowUp') {
      if (target.selectionStart === 0 && index > 0) {
        e.preventDefault();
        setActiveLineIndex(index - 1);
        focusLine(index - 1, 'end');
      }
    }
    else if (e.key === 'ArrowDown') {
      if (target.selectionStart === target.value.length && index < lines.length - 1) {
        e.preventDefault();
        setActiveLineIndex(index + 1);
        focusLine(index + 1, 'start');
      }
    }
  };

  const toggleChecklist = (index: number) => {
    const text = lines[index];
    const newLines = [...lines];
    if (text.startsWith('- [ ] ')) {
      newLines[index] = '- [x] ' + text.substring(6);
    } else if (text.startsWith('- [x] ')) {
      newLines[index] = '- [ ] ' + text.substring(6);
    }
    onChange(newLines.join('\n'));
  };

  return (
    <div ref={containerRef} className={className} style={style} onPaste={onPaste}>
      {lines.map((line, index) => {
        const isChecklist = line.startsWith('- [ ] ') || line.startsWith('- [x] ');
        const isChecked = line.startsWith('- [x] ');
        const textContent = isChecklist ? line.substring(6) : line;
        
        return (
          <div key={index} className={`flex items-start group relative ${isChecklist ? 'my-[2px]' : ''}`}>
            {isChecklist && (
              <div className="pt-[0.3em] mr-2 shrink-0 flex items-center justify-center">
                <div 
                  onClick={() => toggleChecklist(index)}
                  className={`w-4 h-4 rounded border flex items-center justify-center cursor-pointer transition-colors ${
                    isChecked 
                      ? 'bg-primary-accent border-primary-accent' 
                      : 'border-muted-text/50 hover:border-primary-accent'
                  }`}
                >
                  {isChecked && (
                    <svg className="w-3 h-3 text-background" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                    </svg>
                  )}
                </div>
              </div>
            )}
            <AutoResizeTextarea
              value={textContent}
              onChange={(newText: string) => {
                const prefix = isChecklist ? (isChecked ? '- [x] ' : '- [ ] ') : '';
                handleLineChange(index, prefix + newText);
              }}
              onKeyDown={(e: React.KeyboardEvent<HTMLTextAreaElement>) => handleKeyDown(e, index)}
              onFocus={() => setActiveLineIndex(index)}
              placeholder={index === 0 && lines.length === 1 ? placeholder : ''}
              className={`w-full ${isChecked ? 'line-through opacity-50' : ''}`}
            />
          </div>
        );
      })}
    </div>
  );
});

NoteEditor.displayName = 'NoteEditor';
