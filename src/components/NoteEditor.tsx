'use client';

import React, { useEffect, useImperativeHandle, forwardRef } from 'react';
import { useEditor, EditorContent, NodeViewWrapper, ReactNodeViewRenderer, NodeViewProps } from '@tiptap/react';
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

const ResizableImageView = (props: NodeViewProps) => {
  const { node, updateAttributes, deleteNode, selected } = props;
  const [width, setWidth] = React.useState<number | string>(node.attrs.width || '100%');
  const imgRef = React.useRef<HTMLImageElement>(null);
  
  const handleMouseDown = (e: React.MouseEvent) => {
    e.preventDefault();
    const startX = e.pageX;
    const startWidth = imgRef.current?.clientWidth || 0;
    
    const onMouseMove = (moveEvent: MouseEvent) => {
      const currentX = moveEvent.pageX;
      const newWidth = Math.max(100, startWidth + (currentX - startX));
      setWidth(newWidth);
    };
    
    const onMouseUp = () => {
      window.removeEventListener('mousemove', onMouseMove);
      window.removeEventListener('mouseup', onMouseUp);
      const finalWidth = imgRef.current?.clientWidth || 0;
      updateAttributes({ width: finalWidth });
    };
    
    window.addEventListener('mousemove', onMouseMove);
    window.addEventListener('mouseup', onMouseUp);
  };

  const handleDelete = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    deleteNode();
  };

  return (
    <NodeViewWrapper className="relative inline-block my-4 max-w-full group">
      <img
        ref={imgRef}
        src={node.attrs.src}
        alt={node.attrs.alt}
        width={width}
        className="rounded-xl shadow-md border max-w-full h-auto block transition-colors border-white/10"
      />
      <button
        type="button"
        onClick={handleDelete}
        className="absolute top-2 right-2 w-7 h-7 bg-black/60 hover:bg-red-500/80 text-white rounded-full flex items-center justify-center shadow-lg border border-white/20 transition-all z-10 opacity-0 group-hover:opacity-100"
        title="Delete image"
      >
        <svg xmlns="http://www.w3.org/2000/svg" className="w-4 h-4" viewBox="0 0 20 20" fill="currentColor">
          <path fillRule="evenodd" d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z" clipRule="evenodd" />
        </svg>
      </button>
      <div
        className="absolute bottom-0 right-0 w-5 h-5 bg-black/60 hover:bg-black/90 cursor-nwse-resize rounded-tl-lg hidden md:flex items-center justify-center shadow-lg border-t border-l border-white/20 transition-colors z-10"
        onMouseDown={handleMouseDown}
        title="Resize image"
      >
        <svg width="10" height="10" viewBox="0 0 10 10" fill="none" xmlns="http://www.w3.org/2000/svg">
          <path d="M9 1L1 9M9 5L5 9M9 9L9 9" stroke="white" strokeWidth="1.5" strokeLinecap="round"/>
        </svg>
      </div>
    </NodeViewWrapper>
  );
};

const ResizableImage = Image.extend({
  addAttributes() {
    return {
      ...this.parent?.(),
      width: {
        default: null,
        renderHTML: attributes => {
          if (!attributes.width) return {};
          return { width: attributes.width };
        }
      },
    };
  },
  
  addStorage() {
    return {
      markdown: {
        serialize(state: any, node: any) {
          const widthAttr = node.attrs.width ? ` width="${node.attrs.width}"` : '';
          const altAttr = node.attrs.alt ? ` alt="${state.esc(node.attrs.alt)}"` : '';
          state.write(`<img src="${node.attrs.src}"${altAttr}${widthAttr} />`);
        }
      }
    };
  },

  addNodeView() {
    return ReactNodeViewRenderer(ResizableImageView);
  },
});

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
  insertImage: (url: string) => void;
  getHTML: () => string;
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
      ResizableImage,
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
    },
    insertImage: (url: string) => {
      editor?.chain().focus().setImage({ src: url }).run();
    },
    getHTML: () => {
      return editor?.getHTML() || '';
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

        .ProseMirror img.ProseMirror-selectednode,
        .ProseMirror div[data-node-view-wrapper].ProseMirror-selectednode {
          outline: none !important;
        }
      `}} />
    </div>
  );
});

NoteEditor.displayName = 'NoteEditor';
