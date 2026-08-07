'use client';

import React, { useRef, useEffect, useState, useImperativeHandle, forwardRef } from 'react';

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

interface ParsedLine {
  id: string;
  isChecklist: boolean;
  checked: boolean;
  text: string;
}

export const NoteEditor = forwardRef<NoteEditorRef, NoteEditorProps>(({ value, onChange, style, className, placeholder, onPaste }, ref) => {
  const lineInputRefs = useRef<(HTMLTextAreaElement | null)[]>([]);
  const [activeLineIndex, setActiveLineIndex] = useState<number>(0);

  // Parse raw markdown value into structured lines
  const parseLines = (rawText: string): ParsedLine[] => {
    if (!rawText) return [{ id: 'line-0', isChecklist: false, checked: false, text: '' }];
    const rawLines = rawText.split('\n');
    return rawLines.map((line, idx) => {
      if (line.startsWith('- [x] ') || line.startsWith('- [X] ')) {
        return { id: `line-${idx}`, isChecklist: true, checked: true, text: line.substring(6) };
      } else if (line.startsWith('- [ ] ')) {
        return { id: `line-${idx}`, isChecklist: true, checked: false, text: line.substring(6) };
      } else {
        return { id: `line-${idx}`, isChecklist: false, checked: false, text: line };
      }
    });
  };

  const parsedLines = parseLines(value);

  // Re-encode lines back to markdown string
  const serializeLines = (lines: ParsedLine[]): string => {
    return lines.map(line => {
      if (line.isChecklist) {
        return `${line.checked ? '- [x]' : '- [ ]'} ${line.text}`;
      }
      return line.text;
    }).join('\n');
  };

  // Auto-resize individual line textareas
  useEffect(() => {
    lineInputRefs.current.forEach(el => {
      if (el) {
        el.style.height = '0px';
        el.style.height = `${Math.max(el.scrollHeight, 24)}px`;
      }
    });
  }, [value, parsedLines.length]);

  useImperativeHandle(ref, () => ({
    focus: () => {
      const target = lineInputRefs.current[activeLineIndex] || lineInputRefs.current[0];
      target?.focus();
    },
    insertChecklist: () => {
      const lines = [...parsedLines];
      const targetIdx = Math.min(Math.max(0, activeLineIndex), lines.length - 1);
      const current = lines[targetIdx] || { id: `line-${targetIdx}`, isChecklist: false, checked: false, text: '' };

      if (current.isChecklist) {
        // Toggle off checklist
        lines[targetIdx] = { ...current, isChecklist: false, checked: false };
      } else {
        // Toggle on checklist
        lines[targetIdx] = { ...current, isChecklist: true, checked: false };
      }

      const newValue = serializeLines(lines);
      onChange(newValue);

      setTimeout(() => {
        lineInputRefs.current[targetIdx]?.focus();
      }, 0);
    }
  }));

  const handleToggleCheck = (index: number) => {
    const lines = [...parsedLines];
    if (lines[index] && lines[index].isChecklist) {
      lines[index] = { ...lines[index], checked: !lines[index].checked };
      const newValue = serializeLines(lines);
      onChange(newValue);
    }
  };

  const handleLineTextChange = (index: number, newText: string) => {
    // If user typed multi-line paste or text containing newlines
    if (newText.includes('\n')) {
      const split = newText.split('\n');
      const lines = [...parsedLines];
      const current = lines[index];
      const newItems: ParsedLine[] = split.map((s, i) => ({
        id: `line-${Date.now()}-${i}`,
        isChecklist: i === 0 ? current.isChecklist : (s.startsWith('- [ ] ') || s.startsWith('- [x] ')),
        checked: i === 0 ? current.checked : s.startsWith('- [x] '),
        text: s.replace(/^-\s*\[[ xX]\]\s*/, '')
      }));
      lines.splice(index, 1, ...newItems);
      const newValue = serializeLines(lines);
      onChange(newValue);
      setTimeout(() => {
        lineInputRefs.current[index + split.length - 1]?.focus();
      }, 0);
      return;
    }

    const lines = [...parsedLines];
    lines[index] = { ...lines[index], text: newText };
    const newValue = serializeLines(lines);
    onChange(newValue);
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>, index: number) => {
    const currentLine = parsedLines[index];
    const textarea = lineInputRefs.current[index];
    if (!textarea) return;

    const cursor = textarea.selectionStart;

    // Enter Key
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();

      if (currentLine.isChecklist) {
        if (!currentLine.text.trim()) {
          // Empty checklist item -> convert back to normal text line
          const lines = [...parsedLines];
          lines[index] = { ...currentLine, isChecklist: false, checked: false, text: '' };
          const newValue = serializeLines(lines);
          onChange(newValue);
          return;
        } else {
          // Split at cursor and create new checklist item below
          const before = currentLine.text.substring(0, cursor);
          const after = currentLine.text.substring(cursor);

          const lines = [...parsedLines];
          lines[index] = { ...currentLine, text: before };
          lines.splice(index + 1, 0, {
            id: `line-${Date.now()}`,
            isChecklist: true,
            checked: false,
            text: after
          });

          const newValue = serializeLines(lines);
          onChange(newValue);
          setActiveLineIndex(index + 1);
          setTimeout(() => {
            const nextEl = lineInputRefs.current[index + 1];
            nextEl?.focus();
            nextEl?.setSelectionRange(0, 0);
          }, 0);
          return;
        }
      } else {
        // Normal text line split
        const before = currentLine.text.substring(0, cursor);
        const after = currentLine.text.substring(cursor);

        const lines = [...parsedLines];
        lines[index] = { ...currentLine, text: before };
        lines.splice(index + 1, 0, {
          id: `line-${Date.now()}`,
          isChecklist: false,
          checked: false,
          text: after
        });

        const newValue = serializeLines(lines);
        onChange(newValue);
        setActiveLineIndex(index + 1);
        setTimeout(() => {
          const nextEl = lineInputRefs.current[index + 1];
          nextEl?.focus();
          nextEl?.setSelectionRange(0, 0);
        }, 0);
        return;
      }
    }

    // Backspace Key
    if (e.key === 'Backspace' && cursor === 0 && textarea.selectionStart === textarea.selectionEnd) {
      if (currentLine.isChecklist) {
        // Convert checklist item to normal line
        e.preventDefault();
        const lines = [...parsedLines];
        lines[index] = { ...currentLine, isChecklist: false, checked: false };
        const newValue = serializeLines(lines);
        onChange(newValue);
        return;
      } else if (index > 0) {
        // Merge with previous line
        e.preventDefault();
        const prevLine = parsedLines[index - 1];
        const prevLength = prevLine.text.length;

        const lines = [...parsedLines];
        lines[index - 1] = { ...prevLine, text: prevLine.text + currentLine.text };
        lines.splice(index, 1);

        const newValue = serializeLines(lines);
        onChange(newValue);
        setActiveLineIndex(index - 1);
        setTimeout(() => {
          const prevEl = lineInputRefs.current[index - 1];
          prevEl?.focus();
          prevEl?.setSelectionRange(prevLength, prevLength);
        }, 0);
        return;
      }
    }

    // Arrow Navigation
    if (e.key === 'ArrowUp' && index > 0 && cursor === 0) {
      e.preventDefault();
      const prevEl = lineInputRefs.current[index - 1];
      prevEl?.focus();
      const pos = Math.min(cursor, prevEl?.value.length || 0);
      prevEl?.setSelectionRange(pos, pos);
    } else if (e.key === 'ArrowDown' && index < parsedLines.length - 1 && cursor === currentLine.text.length) {
      e.preventDefault();
      const nextEl = lineInputRefs.current[index + 1];
      nextEl?.focus();
      const pos = Math.min(cursor, nextEl?.value.length || 0);
      nextEl?.setSelectionRange(pos, pos);
    }
  };

  return (
    <div 
      className={`w-full min-h-[140px] flex flex-col gap-1 cursor-text ${className || ''}`}
      style={style}
      onClick={() => {
        if (parsedLines.length === 0 || (parsedLines.length === 1 && !parsedLines[0].text)) {
          lineInputRefs.current[0]?.focus();
        }
      }}
    >
      {parsedLines.map((line, idx) => (
        <div key={line.id || `line-${idx}`} className="flex items-start gap-2.5 w-full group/line">
          {line.isChecklist && (
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                handleToggleCheck(idx);
              }}
              className={`mt-1 w-4 h-4 rounded flex items-center justify-center transition-all shrink-0 cursor-pointer ${
                line.checked
                  ? 'bg-primary-accent border border-primary-accent text-white shadow-[0_0_8px_rgba(255,92,56,0.35)]'
                  : 'bg-transparent border border-muted-text/40 hover:border-primary-accent/70 hover:bg-primary-accent/10'
              }`}
              title={line.checked ? 'Mark incomplete' : 'Mark complete'}
            >
              {line.checked && (
                <svg className="w-2.5 h-2.5 stroke-white" viewBox="0 0 24 24" fill="none" strokeWidth="3.5" strokeLinecap="round" strokeLinejoin="round">
                  <polyline points="20 6 9 17 4 12" />
                </svg>
              )}
            </button>
          )}

          <textarea
            ref={(el) => { lineInputRefs.current[idx] = el; }}
            value={line.text}
            onChange={(e) => handleLineTextChange(idx, e.target.value)}
            onFocus={() => setActiveLineIndex(idx)}
            onKeyDown={(e) => handleKeyDown(e, idx)}
            onPaste={onPaste}
            placeholder={idx === 0 && parsedLines.length === 1 ? placeholder : ''}
            rows={1}
            className={`flex-1 bg-transparent resize-none outline-none leading-relaxed overflow-hidden transition-colors ${
              line.checked && line.isChecklist
                ? 'line-through text-muted-text/60 opacity-60'
                : 'text-primary-text placeholder:text-muted-text/40'
            }`}
            style={{
              fontFamily: style?.fontFamily,
              fontSize: style?.fontSize,
              fontWeight: style?.fontWeight,
              fontStyle: style?.fontStyle,
              textDecoration: style?.textDecoration && !line.checked ? style.textDecoration : undefined,
              color: style?.color && !line.checked ? style.color : undefined
            }}
          />
        </div>
      ))}
    </div>
  );
});

NoteEditor.displayName = 'NoteEditor';
