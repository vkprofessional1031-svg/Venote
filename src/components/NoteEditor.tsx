'use client';

import React, { useRef, useEffect, useImperativeHandle, forwardRef } from 'react';

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
  focus: () => void;
}

export const NoteEditor = forwardRef<NoteEditorRef, NoteEditorProps>(({ value, onChange, style, className, placeholder, onPaste }, ref) => {
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  // Auto-resize the single unified textarea to match its full content height
  useEffect(() => {
    if (textareaRef.current) {
      textareaRef.current.style.height = '0px';
      const scrollHeight = textareaRef.current.scrollHeight;
      textareaRef.current.style.height = `${Math.max(scrollHeight, 120)}px`;
    }
  }, [value]);

  useImperativeHandle(ref, () => ({
    focus: () => {
      textareaRef.current?.focus();
    },
    insertChecklist: () => {
      const textarea = textareaRef.current;
      if (!textarea) return;

      const start = textarea.selectionStart ?? 0;
      const end = textarea.selectionEnd ?? 0;

      // Find the line bounds of current selection
      const lineStart = value.lastIndexOf('\n', start - 1) + 1;
      let lineEnd = value.indexOf('\n', end);
      if (lineEnd === -1) lineEnd = value.length;

      const beforeLine = value.substring(0, lineStart);
      const selectedLinesText = value.substring(lineStart, lineEnd);
      const afterLine = value.substring(lineEnd);

      const lines = selectedLinesText.split('\n');
      let cursorDelta = 0;

      const modifiedLines = lines.map((l, idx) => {
        if (l.startsWith('- [ ] ')) {
          if (idx === 0) cursorDelta = -6;
          return l.substring(6);
        } else if (l.startsWith('- [x] ')) {
          if (idx === 0) cursorDelta = -6;
          return l.substring(6);
        } else {
          if (idx === 0) cursorDelta = 6;
          return '- [ ] ' + l;
        }
      });

      const newSelectedText = modifiedLines.join('\n');
      const newValue = beforeLine + newSelectedText + afterLine;
      onChange(newValue);

      setTimeout(() => {
        if (textareaRef.current) {
          textareaRef.current.focus();
          const newPos = Math.max(0, Math.min(newValue.length, start + cursorDelta));
          textareaRef.current.setSelectionRange(newPos, newPos);
        }
      }, 0);
    }
  }));

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    const textarea = textareaRef.current;
    if (!textarea) return;

    const cursor = textarea.selectionStart;
    const lineStart = value.lastIndexOf('\n', cursor - 1) + 1;
    const currentLine = value.substring(lineStart, cursor);

    // Enter key handling on checklist lines
    if (e.key === 'Enter' && !e.shiftKey) {
      if (currentLine === '- [ ] ' || currentLine === '- [x] ') {
        // Clear empty checklist marker
        e.preventDefault();
        const before = value.substring(0, lineStart);
        const after = value.substring(cursor);
        const newValue = before + after;
        onChange(newValue);
        setTimeout(() => {
          if (textareaRef.current) {
            textareaRef.current.setSelectionRange(lineStart, lineStart);
          }
        }, 0);
        return;
      } else if (currentLine.startsWith('- [ ] ') || currentLine.startsWith('- [x] ')) {
        // Auto-continue checklist on next line
        e.preventDefault();
        const before = value.substring(0, cursor);
        const after = value.substring(cursor);
        const insertText = '\n- [ ] ';
        const newValue = before + insertText + after;
        onChange(newValue);
        setTimeout(() => {
          if (textareaRef.current) {
            const newPos = cursor + insertText.length;
            textareaRef.current.setSelectionRange(newPos, newPos);
          }
        }, 0);
        return;
      }
    }

    // Backspace key on checklist prefix
    if (e.key === 'Backspace' && textarea.selectionStart === textarea.selectionEnd) {
      if (cursor === lineStart + 6 && (value.substring(lineStart, cursor) === '- [ ] ' || value.substring(lineStart, cursor) === '- [x] ')) {
        e.preventDefault();
        const before = value.substring(0, lineStart);
        const after = value.substring(cursor);
        const newValue = before + after;
        onChange(newValue);
        setTimeout(() => {
          if (textareaRef.current) {
            textareaRef.current.setSelectionRange(lineStart, lineStart);
          }
        }, 0);
        return;
      }
    }

    // Tab / Shift+Tab indent/unindent
    if (e.key === 'Tab') {
      e.preventDefault();
      if (e.shiftKey) {
        if (value.substring(lineStart, lineStart + 2) === '  ') {
          const before = value.substring(0, lineStart);
          const after = value.substring(lineStart + 2);
          const newValue = before + after;
          onChange(newValue);
          setTimeout(() => {
            if (textareaRef.current) {
              const newPos = Math.max(lineStart, cursor - 2);
              textareaRef.current.setSelectionRange(newPos, newPos);
            }
          }, 0);
        }
      } else {
        const before = value.substring(0, cursor);
        const after = value.substring(cursor);
        const newValue = before + '  ' + after;
        onChange(newValue);
        setTimeout(() => {
          if (textareaRef.current) {
            textareaRef.current.setSelectionRange(cursor + 2, cursor + 2);
          }
        }, 0);
      }
    }
  };

  return (
    <div className={`relative w-full ${className || ''}`}>
      <textarea
        ref={textareaRef}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        onKeyDown={handleKeyDown}
        onPaste={onPaste}
        placeholder={placeholder}
        style={style}
        rows={1}
        className="w-full bg-transparent outline-none resize-none overflow-hidden transition-colors"
        spellCheck
      />
    </div>
  );
});

NoteEditor.displayName = 'NoteEditor';
