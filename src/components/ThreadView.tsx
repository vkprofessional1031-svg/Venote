import { useEffect, useRef, useState } from 'react';
import ChatMarkdown from './ChatMarkdown';

export type Turn = {
  id: string;
  userText: string;
  status: 'pending' | 'done' | 'error';
  kind?: 'organize' | 'wallet' | 'prep' | 'ask';
  entryId?: string;
  answer?: string;
  sources?: { tool: string, args: any, summary: string }[];
  errorMessage?: string;
  
  // For organize preview
  organizePreview?: {
    type: string;
    title: string;
    snippet: string;
  };

  // For wallet/prep
  confirmationMessage?: string;
  originalInput?: string;
  // For streaming Ask
  statusText?: string;
  isStreaming?: boolean;
};

interface ThreadViewProps {
  turns: Turn[];
  onRetry: (turn: Turn) => void;
  onOpenEntry: (entryId: string) => void;
  onFixIt: (turn: Turn, newDomain: string) => void;
  onSaveAs: (turn: Turn, domain: string) => void;
  isProcessing: boolean;
  onRegenerateAsk?: (turn: Turn) => void;
}

export default function ThreadView({ turns, onRetry, onOpenEntry, onFixIt, onSaveAs, isProcessing, onRegenerateAsk }: ThreadViewProps) {
  const endRef = useRef<HTMLDivElement>(null);
  const isNearBottomRef = useRef(true);

  useEffect(() => {
    if (isNearBottomRef.current) {
      endRef.current?.scrollIntoView({ behavior: 'smooth' });
    }
  }, [turns, isProcessing]);

  useEffect(() => {
    let lastHeight = window.visualViewport?.height || window.innerHeight;
    const handleResize = () => {
      const newHeight = window.visualViewport?.height || window.innerHeight;
      if (newHeight < lastHeight && isNearBottomRef.current) {
        setTimeout(() => {
          endRef.current?.scrollIntoView({ behavior: 'auto' });
        }, 100);
      }
      lastHeight = newHeight;
    };
    window.visualViewport?.addEventListener('resize', handleResize);
    return () => window.visualViewport?.removeEventListener('resize', handleResize);
  }, []);

  const handleScroll = (e: React.UIEvent<HTMLDivElement>) => {
    const el = e.currentTarget;
    isNearBottomRef.current = el.scrollHeight - el.scrollTop - el.clientHeight < 100;
  };

  return (
    <div className="flex-1 overflow-y-auto overscroll-contain px-4 py-6 md:px-8 md:py-8 custom-scrollbar w-full" onScroll={handleScroll}>
      <div className="max-w-3xl mx-auto space-y-6">
        {turns.map((turn, idx) => (
          <div key={turn.id} className="space-y-6">
            <div className="flex flex-col ml-auto items-end max-w-[85%]">
              <span className="text-[10px] text-muted-text/50 mb-1 px-1 uppercase tracking-wider font-semibold">You</span>
              <div className="px-4 py-2.5 rounded-2xl text-sm bg-primary-accent/20 text-primary-text border border-primary-accent/30 rounded-br-sm break-words">
                {turn.userText}
              </div>
            </div>

            <div className="flex flex-col mr-auto items-start w-full relative">
              {turn.status === 'pending' && (
                <div className="px-4 py-2 bg-white/5 rounded-2xl rounded-bl-sm border border-white/5 flex gap-2 items-center text-sm text-muted-text w-max">
                  {turn.statusText ? (
                    <>
                      <div className="w-3.5 h-3.5 border-2 border-primary-text/30 border-t-primary-text rounded-full animate-spin"></div>
                      <span>{turn.statusText}</span>
                    </>
                  ) : (
                    <>
                      <span className="w-1.5 h-1.5 bg-muted-text/50 rounded-full animate-bounce"></span>
                      <span className="w-1.5 h-1.5 bg-muted-text/50 rounded-full animate-bounce delay-75"></span>
                      <span className="w-1.5 h-1.5 bg-muted-text/50 rounded-full animate-bounce delay-150"></span>
                    </>
                  )}
                </div>
              )}

              {turn.status === 'error' && (
                <div className="px-4 py-3 bg-red-500/10 text-red-400 border border-red-500/20 rounded-2xl rounded-bl-sm text-sm">
                  {turn.errorMessage || "Something went wrong."}
                  <div className="mt-2">
                    <button 
                      onClick={() => onRetry(turn)}
                      className="px-3 py-1 bg-red-500/20 text-red-300 rounded hover:bg-red-500/30 transition-colors text-xs font-medium"
                    >
                      Retry
                    </button>
                  </div>
                </div>
              )}

              {turn.status === 'done' && turn.kind === 'organize' && turn.organizePreview && (
                <div className="w-full max-w-sm glass-panel-modal border border-white/10 rounded-2xl p-4 shadow-xl">
                  <div className="flex items-center gap-2 mb-2">
                    <span className="text-[10px] font-mono tracking-widest uppercase bg-white/10 px-1.5 py-0.5 rounded text-muted-text">
                      {turn.organizePreview.type}
                    </span>
                    <h3 className="font-serif italic font-bold text-primary-text truncate">
                      {turn.organizePreview.title}
                    </h3>
                  </div>
                  <p className="text-sm text-muted-text/80 mb-3 line-clamp-3">
                    {turn.organizePreview.snippet}
                  </p>
                  <button 
                    onClick={() => turn.entryId && onOpenEntry(turn.entryId)}
                    className="w-full py-2 bg-white/5 hover:bg-white/10 text-primary-text text-sm rounded-lg transition-colors border border-white/5 font-medium"
                  >
                    Open {turn.organizePreview.type}
                  </button>
                </div>
              )}

              {turn.status === 'done' && (turn.kind === 'wallet' || turn.kind === 'prep') && (
                <div className="relative bg-background border border-primary-accent/30 rounded-xl p-3 flex flex-col md:flex-row md:items-center justify-between gap-3 text-sm min-w-[280px]">
                  <div className="flex items-start gap-2">
                    <span className="text-primary-accent">✅</span>
                    <span className="text-primary-text">{turn.confirmationMessage}</span>
                  </div>
                  <TurnFixMenu turn={turn} onFixIt={onFixIt} />
                </div>
              )}

              {turn.status === 'done' && turn.kind === 'ask' && (turn.answer || turn.sources) && (
                <div className="w-full max-w-3xl">
                  <div className="text-sm text-primary-text/90 relative group">
                    <div className="absolute -left-2 md:-left-12 top-0 opacity-0 group-hover:opacity-100 transition-opacity flex flex-col gap-1">
                      <button 
                        onClick={() => navigator.clipboard.writeText(turn.answer || '')}
                        className="p-1.5 text-muted-text hover:text-primary-text bg-[#1A1714] border border-white/10 rounded-lg shadow-sm hidden md:block"
                        title="Copy answer"
                      >
                        <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
                        </svg>
                      </button>
                      {idx === turns.length - 1 && !turn.isStreaming && onRegenerateAsk && (
                        <button 
                          onClick={() => onRegenerateAsk(turn)}
                          className="p-1.5 text-muted-text hover:text-primary-text bg-[#1A1714] border border-white/10 rounded-lg shadow-sm hidden md:block"
                          title="Regenerate response"
                        >
                          <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                          </svg>
                        </button>
                      )}
                    </div>
                    {turn.answer && <ChatMarkdown content={turn.answer} />}
                    
                    <div className="md:hidden mt-1 flex items-center gap-1 h-[36px] max-h-[40px] -ml-2">
                      <button 
                        onClick={() => navigator.clipboard.writeText(turn.answer || '')}
                        className="flex items-center justify-center w-[36px] h-[36px] text-muted-text/70 hover:text-primary-text transition-colors"
                        title="Copy answer"
                      >
                        <svg xmlns="http://www.w3.org/2000/svg" className="h-[18px] w-[18px]" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
                        </svg>
                      </button>
                      {idx === turns.length - 1 && !turn.isStreaming && onRegenerateAsk && (
                        <button 
                          onClick={() => onRegenerateAsk(turn)}
                          className="flex items-center justify-center w-[36px] h-[36px] text-muted-text/70 hover:text-primary-text transition-colors"
                          title="Regenerate"
                        >
                          <svg xmlns="http://www.w3.org/2000/svg" className="h-[18px] w-[18px]" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                          </svg>
                        </button>
                      )}
                    </div>

                    {turn.isStreaming && (
                      <div className="mt-1 flex items-center gap-2 text-muted-text/50">
                        <span className="w-2 h-2 bg-primary-text/60 rounded-full animate-pulse"></span>
                      </div>
                    )}
                  </div>
                  
                  {turn.sources && turn.sources.length > 0 && (
                    <div className="mt-3">
                      <details className="group">
                        <summary className="cursor-pointer text-sm font-mono text-muted-text/60 hover:text-muted-text list-none flex items-center gap-1.5 select-none min-h-[44px] py-2">
                          <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 transition-transform group-open:rotate-90" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                          </svg>
                          Based on {turn.sources.length} lookup{turn.sources.length !== 1 ? 's' : ''}
                        </summary>
                        <div className="mt-1 pl-4 border-l-2 border-white/10 space-y-1.5">
                          {turn.sources.map((src, i) => (
                            <div key={i} className="text-xs font-mono text-muted-text/80 flex items-center gap-1.5 leading-relaxed">
                              <span className="text-white/20">■</span>
                              {src.summary}
                            </div>
                          ))}
                        </div>
                      </details>
                    </div>
                  )}

                  {idx === 0 && (
                    <div className="mt-6 pt-4 border-t border-white/5 flex flex-col md:flex-row md:items-center gap-3">
                      <span className="text-sm text-muted-text/70 mb-1 md:mb-0">Not a question? Save it as:</span>
                      <div className="flex flex-wrap items-center gap-2">
                        {['organize', 'wallet', 'prep'].map(d => (
                          <button
                            key={d}
                            onClick={() => onSaveAs(turn, d)}
                            className="text-sm font-medium text-primary-text bg-white/5 border border-white/10 hover:bg-white/10 hover:border-white/20 transition-all rounded-full px-4 min-h-[36px] flex items-center justify-center"
                          >
                            {d === 'organize' ? 'Note' : d === 'wallet' ? 'Wallet' : 'Job'}
                          </button>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>
        ))}
        <div ref={endRef} />
      </div>
    </div>
  );
}

function TurnFixMenu({ turn, onFixIt }: { turn: Turn, onFixIt: (turn: Turn, newDomain: string) => void }) {
  const [showMenu, setShowMenu] = useState(false);
  return (
    <div className="relative">
      <button onClick={() => setShowMenu(!showMenu)} className="text-muted-text hover:text-primary-accent text-xs font-medium underline underline-offset-2 shrink-0">
        Not right? Fix it
      </button>
      {showMenu && (
        <div className="absolute right-0 mt-1 w-48 bg-[#1A1714] border border-hairline rounded-lg shadow-xl z-50 overflow-hidden">
          <div className="px-3 py-2 text-[10px] font-mono tracking-wider text-muted-text uppercase bg-black/20">
            Reclassify as...
          </div>
          {['organize', 'wallet', 'prep'].filter(d => d !== turn.kind).map(domain => (
            <button
              key={domain}
              onClick={() => { setShowMenu(false); onFixIt(turn, domain); }}
              className="block w-full text-left px-3 py-2 text-sm text-primary-text hover:bg-white/5 transition-colors"
            >
              {domain === 'organize' ? 'Organize (Task/Note)' : domain === 'wallet' ? 'Wallet (Expense/Income)' : 'Prep (Round/Session)'}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
