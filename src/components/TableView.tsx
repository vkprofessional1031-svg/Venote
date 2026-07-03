'use client';

import React, { useState, useRef, useEffect } from 'react';

export interface TableViewProps {
  title: string;
  columns: string[];
  rows: string[][];
  onUpdate?: (data: any) => void;
}

export default function TableView({ title, columns = [], rows = [], onUpdate }: TableViewProps) {
  const [editingTitle, setEditingTitle] = useState(false);
  const [titleText, setTitleText] = useState(title);
  
  const [editingCell, setEditingCell] = useState<{ r: number, c: number } | null>(null);
  const [cellText, setCellText] = useState('');
  const [toastMessage, setToastMessage] = useState<string | null>(null);
  
  const titleInputRef = useRef<HTMLInputElement>(null);
  const cellInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (editingTitle && titleInputRef.current) titleInputRef.current.focus();
  }, [editingTitle]);

  useEffect(() => {
    if (editingCell !== null && cellInputRef.current) cellInputRef.current.focus();
  }, [editingCell]);

  const saveTitle = () => {
    if (onUpdate && titleText.trim() && titleText !== title) {
      onUpdate({ type: 'table', title: titleText, columns, rows });
    }
    setEditingTitle(false);
  };

  const saveCell = () => {
    if (editingCell !== null && onUpdate) {
      const { r, c } = editingCell;
      if (rows[r][c] !== cellText) {
        const newRows = [...rows];
        newRows[r] = [...newRows[r]];
        newRows[r][c] = cellText;
        onUpdate({ type: 'table', title, columns, rows: newRows });
      }
    }
    setEditingCell(null);
  };

  const addRow = () => {
    if (onUpdate) {
      const emptyRow = Array(columns.length || 1).fill('');
      onUpdate({ type: 'table', title, columns, rows: [...rows, emptyRow] });
    }
  };

  const removeRow = (e: React.MouseEvent, rowIndex: number) => {
    e.stopPropagation();
    if (onUpdate) {
      const newRows = rows.filter((_, i) => i !== rowIndex);
      onUpdate({ type: 'table', title, columns, rows: newRows });
    }
  };

  const addColumn = () => {
    const colName = window.prompt("Enter new column name:");
    if (colName && colName.trim() && onUpdate) {
      const newColumns = [...columns, colName.trim()];
      const newRows = rows.map(r => [...r, '']);
      onUpdate({ type: 'table', title, columns: newColumns, rows: newRows });
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent, action: () => void, cancelAction: () => void) => {
    if (e.key === 'Enter') action();
    else if (e.key === 'Escape') cancelAction();
  };

  const handleShare = async () => {
    let text = `${title}\n\n`;
    if (columns && columns.length > 0) {
      text += columns.join(' | ') + '\n';
      text += columns.map(() => '---').join('-|-') + '\n';
    }
    if (rows && rows.length > 0) {
      rows.forEach(row => {
        text += (row || []).join(' | ') + '\n';
      });
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
          <span className="font-mono text-[10px] tracking-widest uppercase px-2 py-1 rounded bg-secondary-accent/10 text-secondary-accent flex items-center gap-1.5 font-bold">
            <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 10h18M3 14h18m-9-4v8m-7 0h14a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z" /></svg>
            TABLE
          </span>
          <div className="flex items-center gap-1">
            <button 
              onClick={handleShare}
              className="p-2 text-muted-text hover:text-secondary-accent transition-colors rounded-lg bg-background/50 hover:bg-background"
              title="Share card"
            >
              <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" viewBox="0 0 20 20" fill="currentColor">
                <path d="M15 8a3 3 0 10-2.977-2.63l-4.94 2.47a3 3 0 100 4.319l4.94 2.47a3 3 0 10.895-1.789l-4.94-2.47a3.027 3.027 0 000-.74l4.94-2.47C13.456 7.68 14.19 8 15 8z" />
              </svg>
            </button>
            <button 
              onClick={() => setEditingTitle(true)}
              className="p-2 text-muted-text hover:text-primary-text transition-colors rounded-lg bg-background/50 hover:bg-background"
              title="Edit card"
            >
              <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" viewBox="0 0 20 20" fill="currentColor">
                <path d="M13.586 3.586a2 2 0 112.828 2.828l-.793.793-2.828-2.828.793-.793zM11.379 5.793L3 14.172V17h2.828l8.38-8.379-2.83-2.828z" />
              </svg>
            </button>
          </div>
          
          {toastMessage && (
            <div className="absolute top-full right-0 mt-2 px-3 py-1.5 bg-secondary-accent text-card text-xs font-bold rounded shadow-lg z-10 transition-opacity">
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
        
        <div className="overflow-x-auto -mx-6 px-6 md:mx-0 md:px-0 scrollbar-hide">
          <div className="rounded-xl border border-hairline bg-background/30 w-max min-w-full">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="border-b border-hairline">
                  {columns.map((col, index) => (
                    <th 
                      key={index}
                      className="px-6 py-5 text-xs font-mono font-bold text-muted-text uppercase tracking-widest whitespace-nowrap bg-card/50"
                    >
                      {col}
                    </th>
                  ))}
                  <th className="px-6 py-5 w-[60px] bg-card/50 text-right">
                    <button
                      onClick={addColumn}
                      className="text-muted-text hover:text-primary-text p-1 bg-background/50 rounded transition-colors inline-flex items-center justify-center"
                      title="Add column"
                    >
                      <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" viewBox="0 0 20 20" fill="currentColor">
                        <path fillRule="evenodd" d="M10 3a1 1 0 011 1v5h5a1 1 0 110 2h-5v5a1 1 0 11-2 0v-5H4a1 1 0 110-2h5V4a1 1 0 011-1z" clipRule="evenodd" />
                      </svg>
                    </button>
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-hairline">
                {rows.map((row, rowIndex) => (
                  <tr key={rowIndex} className="hover:bg-card/80 transition-colors group/row">
                    {row.map((cell, cellIndex) => (
                      <td 
                        key={cellIndex}
                        className="px-6 py-5 text-base font-sans text-primary-text whitespace-nowrap relative"
                      >
                        {editingCell?.r === rowIndex && editingCell?.c === cellIndex ? (
                          <input
                            ref={cellInputRef}
                            type="text"
                            value={cellText}
                            onChange={(e) => setCellText(e.target.value)}
                            onBlur={saveCell}
                            onKeyDown={(e) => handleKeyDown(e, saveCell, () => setEditingCell(null))}
                            className="absolute inset-0 w-full h-full bg-background/90 text-primary-text px-6 font-sans text-base outline-none border border-primary-accent/50 z-10"
                          />
                        ) : (
                          <div 
                            onClick={() => {
                              setEditingCell({ r: rowIndex, c: cellIndex });
                              setCellText(cell);
                            }}
                            className="cursor-text hover:bg-background/50 -m-2 p-2 rounded transition-colors min-h-[1.5rem]"
                          >
                            {cell}
                          </div>
                        )}
                      </td>
                    ))}
                    <td className="px-6 py-5 whitespace-nowrap text-right">
                      <button
                        onClick={(e) => removeRow(e, rowIndex)}
                        className="p-2 -mr-2 text-muted-text hover:text-red-400 opacity-100 md:opacity-0 md:group-hover/row:opacity-100 transition-opacity rounded"
                        title="Remove row"
                      >
                        <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 md:h-4 md:w-4" viewBox="0 0 20 20" fill="currentColor">
                          <path fillRule="evenodd" d="M9 2a1 1 0 00-.894.553L7.382 4H4a1 1 0 000 2v10a2 2 0 002 2h8a2 2 0 002-2V6a1 1 0 100-2h-3.382l-.724-1.447A1 1 0 0011 2H9zM7 8a1 1 0 012 0v6a1 1 0 11-2 0V8zm5-1a1 1 0 00-1 1v6a1 1 0 102 0V8a1 1 0 00-1-1z" clipRule="evenodd" />
                        </svg>
                      </button>
                    </td>
                  </tr>
                ))}
                
                <tr>
                  <td colSpan={(columns.length || 1) + 1} className="p-2">
                    <button
                      onClick={addRow}
                      className="w-full flex items-center justify-center gap-2 py-3 text-sm font-bold text-muted-text hover:text-primary-text hover:bg-background/50 rounded-lg transition-colors border border-dashed border-hairline hover:border-muted-text/30"
                    >
                      <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" viewBox="0 0 20 20" fill="currentColor">
                        <path fillRule="evenodd" d="M10 3a1 1 0 011 1v5h5a1 1 0 110 2h-5v5a1 1 0 11-2 0v-5H4a1 1 0 110-2h5V4a1 1 0 011-1z" clipRule="evenodd" />
                      </svg>
                      ADD ROW
                    </button>
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
}
