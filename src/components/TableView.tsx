import React from 'react';

export interface TableViewProps {
  title: string;
  columns: string[];
  rows: string[][];
}

export default function TableView({ title, columns, rows }: TableViewProps) {
  return (
    <div className="w-full bg-card rounded-[24px] border border-hairline overflow-hidden shadow-2xl">
      <div className="p-8 md:p-10">
        <div className="flex items-center gap-3 mb-8">
          <span className="font-mono text-[10px] tracking-widest uppercase px-2 py-1 rounded bg-secondary-accent/10 text-secondary-accent flex items-center gap-1.5 font-bold">
            <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 10h18M3 14h18m-9-4v8m-7 0h14a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z" /></svg>
            TABLE
          </span>
        </div>

        <h2 className="font-serif italic font-bold text-4xl text-primary-text mb-8 tracking-tight leading-snug">
          {title}
        </h2>
        
        <div className="overflow-x-auto rounded-xl border border-hairline bg-background/30">
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
              </tr>
            </thead>
            <tbody className="divide-y divide-hairline">
              {rows.map((row, rowIndex) => (
                <tr key={rowIndex} className="hover:bg-card/80 transition-colors">
                  {row.map((cell, cellIndex) => (
                    <td 
                      key={cellIndex}
                      className="px-6 py-5 text-base font-sans text-primary-text whitespace-nowrap"
                    >
                      {cell}
                    </td>
                  ))}
                </tr>
              ))}
              
              {(!rows || rows.length === 0) && (
                <tr>
                  <td 
                    colSpan={columns.length || 1} 
                    className="px-6 py-12 text-center font-sans text-sm text-muted-text italic"
                  >
                    No data available.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
