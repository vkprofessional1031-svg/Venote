'use client';

import React, { useEffect, useImperativeHandle, forwardRef } from 'react';
import { useEditor, EditorContent } from '@tiptap/react';
import { BubbleMenu } from '@tiptap/react/menus';
import StarterKit from '@tiptap/starter-kit';
import TaskList from '@tiptap/extension-task-list';
import TaskItem from '@tiptap/extension-task-item';
import Placeholder from '@tiptap/extension-placeholder';
import Underline from '@tiptap/extension-underline';
import Highlight from '@tiptap/extension-highlight';
import Image from '@tiptap/extension-image';
import { Markdown } from 'tiptap-markdown';
import { SlashCommands, getSuggestionItems, renderItems } from './SlashCommand';

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
  const editor = useEditor({
    extensions: [
      StarterKit,
      TaskList.configure({
        HTMLAttributes: {
          class: 'tiptap-task-list flex flex-col gap-1',
        },
      }),
      TaskItem.configure({
        nested: true,
        HTMLAttributes: {
          class: 'flex items-start gap-2.5 tiptap-task-item',
        },
      }),
      Placeholder.configure({ 
        placeholder: placeholder || 'Type something...',
        emptyEditorClass: 'is-editor-empty',
      }),
      Underline,
      Highlight.configure({
        HTMLAttributes: {
          class: 'bg-[#FF5C38]/30 text-[#F5EDD9] rounded-sm px-1',
        },
      }),
      Image.configure({
        HTMLAttributes: {
          class: 'rounded-xl max-w-full h-auto shadow-md border border-white/10 my-4',
        },
      }),
      SlashCommands.configure({
        suggestion: {
          items: getSuggestionItems,
          render: renderItems,
        },
      }),
      Markdown,
    ],
    content: value,
    editorProps: {
      attributes: {
        class: 'outline-none min-h-[140px] leading-relaxed w-full prose prose-invert max-w-none text-primary-text',
        style: style ? Object.entries(style).map(([k, v]) => `${k.replace(/([A-Z])/g, '-$1').toLowerCase()}:${v}`).join(';') : '',
      },
      handlePaste: (view, event) => {
        if (onPaste) {
          // If the parent provided an onPaste handler, call it.
          // Note: returning true prevents default TipTap paste behavior if we want to override completely,
          // but usually we just want to call the side-effect and let TipTap handle text insertion.
          onPaste(event as any);
        }
        return false;
      },
    },
    onUpdate: ({ editor }) => {
      // Use Markdown extension to get raw markdown
      const markdown = (editor.storage as any).markdown.getMarkdown();
      onChange(markdown);
    },
  });

  // Update content from outside if changed externally (e.g. AI updates or switching notes)
  useEffect(() => {
    if (editor) {
      const currentMarkdown = (editor.storage as any).markdown.getMarkdown();
      if (currentMarkdown !== value) {
        editor.commands.setContent(value);
      }
    }
  }, [value, editor]);

  useImperativeHandle(ref, () => ({
    focus: () => {
      editor?.commands.focus();
    },
    insertChecklist: () => {
      editor?.commands.toggleTaskList();
      editor?.commands.focus();
    }
  }));

  return (
    <div 
      className={`w-full cursor-text ${className || ''}`} 
      onClick={(e) => {
        // Only focus if the user isn't currently highlighting text
        if (!window.getSelection()?.toString()) {
          editor?.commands.focus();
        }
      }}
    >
      {editor && (
        <BubbleMenu 
          editor={editor} 
          className="flex items-center gap-1 p-1 md:p-1.5 bg-[#1C1816]/95 backdrop-blur-xl border border-white/10 rounded-full shadow-[0_10px_30px_rgba(0,0,0,0.4)]"
        >
          <button
            onClick={() => editor.chain().focus().toggleBold().run()}
            className={`p-2.5 md:p-1.5 rounded-full transition-colors ${editor.isActive('bold') ? 'bg-[#FF5C38]/20 text-[#FF5C38]' : 'text-white/60 hover:text-white hover:bg-white/5'}`}
            title="Bold"
          >
            <svg className="w-4 h-4 md:w-4 md:h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M6 4h8a4 4 0 0 1 4 4 4 4 0 0 1-4 4H6z"></path><path d="M6 12h9a4 4 0 0 1 4 4 4 4 0 0 1-4 4H6z"></path></svg>
          </button>
          <button
            onClick={() => editor.chain().focus().toggleItalic().run()}
            className={`p-2.5 md:p-1.5 rounded-full transition-colors ${editor.isActive('italic') ? 'bg-[#FF5C38]/20 text-[#FF5C38]' : 'text-white/60 hover:text-white hover:bg-white/5'}`}
            title="Italic"
          >
            <svg className="w-4 h-4 md:w-4 md:h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="19" y1="4" x2="10" y2="4"></line><line x1="14" y1="20" x2="5" y2="20"></line><line x1="15" y1="4" x2="9" y2="20"></line></svg>
          </button>
          <button
            onClick={() => editor.chain().focus().toggleUnderline().run()}
            className={`p-2.5 md:p-1.5 rounded-full transition-colors ${editor.isActive('underline') ? 'bg-[#FF5C38]/20 text-[#FF5C38]' : 'text-white/60 hover:text-white hover:bg-white/5'}`}
            title="Underline"
          >
            <svg className="w-4 h-4 md:w-4 md:h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M6 3v7a6 6 0 0 0 6 6 6 6 0 0 0 6-6V3"></path><line x1="4" y1="21" x2="20" y2="21"></line></svg>
          </button>
          <div className="w-px h-5 md:h-4 bg-white/10 mx-1" />
          <button
            onClick={() => editor.chain().focus().toggleHighlight().run()}
            className={`p-2.5 md:p-1.5 rounded-full transition-colors ${editor.isActive('highlight') ? 'bg-[#FF5C38]/20 text-[#FF5C38]' : 'text-white/60 hover:text-white hover:bg-white/5'}`}
            title="Highlight"
          >
             <svg className="w-4 h-4 md:w-4 md:h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M12 19l7-7 3 3-7 7-3-3z"/><path d="M18 13l-1.5-7.5L2 2l3.5 14.5L13 18l5-5z"/><path d="M2 2l7.586 7.586"/><circle cx="11" cy="11" r="2"/></svg>
          </button>
        </BubbleMenu>
      )}
      <EditorContent editor={editor} />
      
      {/* 
        Custom CSS for TipTap checkboxes to match glassmorphism design.
        We inject this here so we don't have to pollute globals.css.
      */}
      <style dangerouslySetInnerHTML={{ __html: `
        .tiptap p.is-editor-empty:first-child::before {
          content: attr(data-placeholder);
          float: left;
          color: rgba(255, 255, 255, 0.4);
          pointer-events: none;
          height: 0;
        }
        
        .tiptap-task-list {
          list-style: none;
          padding: 0;
          margin: 0;
        }

        .tiptap-task-item {
          display: flex;
          align-items: flex-start;
          gap: 10px;
          margin-bottom: 4px;
        }

        .tiptap-task-item label {
          margin-top: 4px;
          flex-shrink: 0;
          cursor: pointer;
          user-select: none;
          -webkit-user-select: none;
        }

        .tiptap-task-item {
          margin-bottom: 0.5rem;
        }

        .tiptap-task-item input[type="checkbox"] {
          appearance: none;
          width: 24px;
          height: 24px;
          border-radius: 6px;
          background: transparent;
          border: 1.5px solid rgba(255, 255, 255, 0.2);
          cursor: pointer;
          position: relative;
          display: flex;
          align-items: center;
          justify-content: center;
          transition: all 0.2s cubic-bezier(0.34, 1.56, 0.64, 1);
          flex-shrink: 0;
        }

        .tiptap-task-item input[type="checkbox"]:hover {
          border-color: rgba(255, 92, 56, 0.7);
          background: rgba(255, 92, 56, 0.05);
        }

        .tiptap-task-item input[type="checkbox"]:checked {
          background: linear-gradient(135deg, #FF6B45, #E14A22);
          border-color: transparent;
          box-shadow: 0 2px 10px rgba(255, 92, 56, 0.4);
          transform: scale(1.05);
        }

        .tiptap-task-item input[type="checkbox"]:checked::after {
          content: '';
          position: absolute;
          width: 5px;
          height: 12px;
          border: solid white;
          border-width: 0 2px 2px 0;
          transform: rotate(45deg);
          margin-top: -3px;
        }

        .tiptap-task-item[data-checked="true"] > div {
          text-decoration: line-through;
          opacity: 0.5;
          color: rgba(255, 255, 255, 0.5);
        }

        .tiptap-task-item > div {
          flex: 1;
        }

        .tiptap p {
          margin-top: 0;
          margin-bottom: 0.25rem;
        }
      `}} />
    </div>
  );
});

NoteEditor.displayName = 'NoteEditor';
