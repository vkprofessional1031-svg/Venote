import React, { useMemo } from 'react';

export interface Entry {
  id: string;
  createdAt: number;
  updatedAt?: number;
  results: any[];
  pinned?: boolean;
  tags?: string[];
  isArchived?: boolean;
  imageUrls?: string[];
}
export type SortOption = 'newest' | 'oldest' | 'az' | 'edited';

interface EntriesListProps {
  entries: Entry[];
  activeTagFilter: string | null;
  searchQuery: string;
  sortOption: SortOption;
  entriesLoading: boolean;
  activeEntryId: string | null;
  editingEntryId: string | null;
  editingTitle: string;
  setActiveEntryId: (id: string | null) => void;
  setIsMobileMenuOpen: (open: boolean) => void;
  setEditingTitle: (title: string) => void;
  handleRenameKeyDown: (e: React.KeyboardEvent, id: string) => void;
  saveRename: (id: string) => void;
  handleTogglePin: (e: React.MouseEvent, id: string, currentPinned: boolean) => void;
  startRename: (e: React.MouseEvent, id: string, currentTitle: string) => void;
  handleDelete: (e: React.MouseEvent, id: string) => void;
  showArchived: boolean;
  handleArchiveToggle: (e: React.MouseEvent, id: string, currentArchived: boolean) => void;
}

export default function EntriesList({
  entries,
  activeTagFilter,
  searchQuery,
  sortOption,
  entriesLoading,
  activeEntryId,
  editingEntryId,
  editingTitle,
  setActiveEntryId,
  setIsMobileMenuOpen,
  setEditingTitle,
  handleRenameKeyDown,
  saveRename,
  handleTogglePin,
  startRename,
  handleDelete,
  showArchived,
  handleArchiveToggle
}: EntriesListProps) {
  
  const getBadgeStyle = (type: string) => {
    switch (type) {
      case 'tasks':
        return 'bg-primary-accent/10 text-primary-accent';
      case 'note':
        return 'bg-tertiary-accent/10 text-tertiary-accent';
      case 'table':
        return 'bg-secondary-accent/10 text-secondary-accent';
      case 'roadmap':
        return 'bg-[#1D9E75]/10 text-[#1D9E75]';
      default:
        return 'bg-muted-text/10 text-muted-text';
    }
  };

  const formatDate = (ts: number) => {
    const d = new Date(ts);
    const now = new Date();
    const isToday = d.getDate() === now.getDate() && d.getMonth() === now.getMonth() && d.getFullYear() === now.getFullYear();
    const yesterday = new Date(now);
    yesterday.setDate(now.getDate() - 1);
    const isYesterday = d.getDate() === yesterday.getDate() && d.getMonth() === yesterday.getMonth() && d.getFullYear() === yesterday.getFullYear();

    if (isToday) return 'Today';
    if (isYesterday) return 'Yesterday';
    
    return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
  };

  const getSnippet = (entry: any) => {
    const res = entry.results?.[0];
    if (!res) return '';
    if (res.type === 'note') {
      return res.body ? res.body.substring(0, 50) + '...' : 'No content';
    } else if (res.type === 'tasks') {
      const total = res.items?.length || 0;
      const done = res.items?.filter((i: any) => i.done).length || 0;
      return `${total} items · ${done} completed`;
    } else if (res.type === 'table') {
      return res.columns?.join(' · ') || 'Table data';
    } else if (res.type === 'roadmap') {
      return `${res.milestones?.length || 0} steps to: ${res.goal || 'Goal'}`;
    }
    return '';
  };

  const { pinnedEntries, unpinnedEntries, filteredEntries } = useMemo(() => {
    const q = searchQuery.toLowerCase();
    const filtered = entries.filter(entry => {
      // Archive filter
      if (showArchived) {
        if (!entry.isArchived) return false;
      } else {
        if (entry.isArchived) return false;
      }

      // Tag filter
      if (activeTagFilter && !(entry.tags || []).includes(activeTagFilter)) {
        return false;
      }
      
      // Search filter
      if (!q) return true;
      return entry.results?.some((res: any) => {
        if (res.title && res.title.toLowerCase().includes(q)) return true;
        if (res.body && res.body.toLowerCase().includes(q)) return true;
        if (res.items && res.items.some((task: any) => task.text.toLowerCase().includes(q))) return true;
        if (res.embeddedTasks && res.embeddedTasks.some((task: any) => task.text.toLowerCase().includes(q))) return true;
        if (res.milestones && res.milestones.some((m: any) => m.label.toLowerCase().includes(q) || m.description.toLowerCase().includes(q))) return true;
        return false;
      });
    }).sort((a, b) => {
      if (a.pinned && !b.pinned) return -1;
      if (!a.pinned && b.pinned) return 1;
      
      if (sortOption === 'oldest') {
        return a.createdAt - b.createdAt;
      } else if (sortOption === 'az') {
        const titleA = a.results?.[0]?.title?.toLowerCase() || '';
        const titleB = b.results?.[0]?.title?.toLowerCase() || '';
        return titleA.localeCompare(titleB);
      } else if (sortOption === 'edited') {
        const timeA = a.updatedAt || a.createdAt;
        const timeB = b.updatedAt || b.createdAt;
        return timeB - timeA;
      } else {
        // newest
        return b.createdAt - a.createdAt;
      }
    });

    return {
      filteredEntries: filtered,
      pinnedEntries: filtered.filter(e => e.pinned),
      unpinnedEntries: filtered.filter(e => !e.pinned)
    };
  }, [entries, activeTagFilter, searchQuery, sortOption, showArchived]);

  if (entriesLoading) {
    return (
      <div className="flex justify-center p-4">
        <svg className="animate-spin h-5 w-5 text-muted-text" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
        </svg>
      </div>
    );
  }

  if (entries.length === 0) {
    return (
      <p className="text-sm text-muted-text text-center italic mt-4">
        No entries yet — create your first one.
      </p>
    );
  }

  if (filteredEntries.length === 0) {
    return (
      <p className="text-sm text-muted-text text-center italic mt-4">
        No entries found.
      </p>
    );
  }

  return (
    <>
      {pinnedEntries.length > 0 && (
        <div className="mb-3 space-y-0.5">
          <div className="px-2 pb-1">
            <span className="text-[10px] font-mono tracking-[0.2em] text-primary-accent uppercase flex items-center gap-1.5">
              <svg xmlns="http://www.w3.org/2000/svg" className="h-3 w-3" viewBox="0 0 20 20" fill="currentColor">
                <path fillRule="evenodd" d="M10 2a1 1 0 011 1v1h2a2 2 0 012 2v2l2 3v2h-6v4.5a.5.5 0 01-1 0V13H4v-2l2-3V6a2 2 0 012-2h2V3a1 1 0 011-1z" clipRule="evenodd" />
              </svg>
              Pinned
            </span>
          </div>
          {pinnedEntries.map((entry) => (
            <div
              key={entry.id}
              onClick={() => {
                if (editingEntryId !== entry.id) {
                  setActiveEntryId(entry.id);
                  setIsMobileMenuOpen(false);
                }
              }}
              className={`group relative w-full text-left p-2.5 md:p-3.5 rounded-xl transition-all cursor-pointer border-l-2 ${
                activeEntryId === entry.id
                  ? 'bg-primary-accent/5 border-primary-accent'
                  : 'hover:bg-card border-transparent'
              }`}
            >
              <div className="flex items-start justify-between mb-2">
                <div className="flex flex-wrap gap-1.5">
                  {entry.results?.map((res: any, idx: number) => (
                    <span key={idx} className={`font-mono text-[10px] tracking-widest uppercase px-1.5 py-0.5 rounded-sm flex items-center gap-1 ${getBadgeStyle(res.type)}`}>
                      {res.type === 'note' && (
                        <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" /></svg>
                      )}
                      {res.type === 'tasks' && (
                        <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9l2 2 4-4" /></svg>
                      )}
                      {res.type === 'table' && (
                        <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 10h18M3 14h18m-9-4v8m-7 0h14a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z" /></svg>
                      )}
                      {res.type === 'tasks' ? 'TASK' : res.type?.toUpperCase() || 'UNKNOWN'}
                    </span>
                  ))}
                </div>
                <span className="font-mono text-muted-text text-[10px] tracking-wide shrink-0 ml-2 mt-0.5">
                  {formatDate(entry.createdAt)}
                </span>
              </div>

              <div className="flex items-center justify-between gap-2 mt-0.5">
                <div className="flex-1 min-w-0">
                  {editingEntryId === entry.id ? (
                    <input
                      type="text"
                      autoFocus
                      value={editingTitle}
                      onChange={(e) => setEditingTitle(e.target.value)}
                      onKeyDown={(e) => handleRenameKeyDown(e, entry.id)}
                      onBlur={() => saveRename(entry.id)}
                      onClick={(e) => e.stopPropagation()}
                      className="w-full font-serif italic font-bold text-lg md:text-xl text-primary-text bg-background border border-hairline rounded px-2 py-1 outline-none focus:border-primary-accent"
                    />
                  ) : (
                    <h3 className="font-serif italic font-bold text-lg md:text-xl text-primary-text truncate tracking-tight">
                      {entry.results?.[0]?.title || 'Untitled'}
                    </h3>
                  )}
                </div>

                {/* Actions (Always visible on mobile, hover on desktop) */}
                {editingEntryId !== entry.id && (
                  <div className="shrink-0 flex items-center gap-1 opacity-100 md:opacity-0 md:group-hover:opacity-100 transition-opacity">
                    <button
                      type="button"
                      onClick={(e) => handleTogglePin(e, entry.id, !!entry.pinned)}
                      className={`p-3 md:p-2 rounded transition-colors ${entry.pinned ? 'text-primary-accent' : 'text-muted-text hover:text-primary-text hover:bg-background/50'}`}
                      title={entry.pinned ? "Unpin" : "Pin"}
                    >
                      <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 md:h-4 md:w-4" viewBox="0 0 20 20" fill="currentColor">
                        <path fillRule="evenodd" d="M10 2a1 1 0 011 1v1h2a2 2 0 012 2v2l2 3v2h-6v4.5a.5.5 0 01-1 0V13H4v-2l2-3V6a2 2 0 012-2h2V3a1 1 0 011-1z" clipRule="evenodd" />
                      </svg>
                    </button>
                    <button
                      type="button"
                      onClick={(e) => startRename(e, entry.id, entry.results?.[0]?.title)}
                      className="p-3 md:p-2 text-muted-text hover:text-primary-text hover:bg-background/50 rounded transition-colors"
                      title="Rename"
                    >
                      <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 md:h-4 md:w-4" viewBox="0 0 20 20" fill="currentColor">
                        <path d="M13.586 3.586a2 2 0 112.828 2.828l-.793.793-2.828-2.828.793-.793zM11.379 5.793L3 14.172V17h2.828l8.38-8.379-2.83-2.828z" />
                      </svg>
                    </button>
                    <button
                      type="button"
                      onClick={(e) => handleDelete(e, entry.id)}
                      className="p-3 md:p-2 text-muted-text hover:text-red-400 hover:bg-background/50 rounded transition-colors"
                      title="Delete"
                    >
                      <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 md:h-4 md:w-4" viewBox="0 0 20 20" fill="currentColor">
                        <path fillRule="evenodd" d="M9 2a1 1 0 00-.894.553L7.382 4H4a1 1 0 000 2v10a2 2 0 002 2h8a2 2 0 002-2V6a1 1 0 100-2h-3.382l-.724-1.447A1 1 0 0011 2H9zM7 8a1 1 0 012 0v6a1 1 0 11-2 0V8zm5-1a1 1 0 00-1 1v6a1 1 0 102 0V8a1 1 0 00-1-1z" clipRule="evenodd" />
                      </svg>
                    </button>
                    <button
                      type="button"
                      onClick={(e) => handleArchiveToggle(e, entry.id, !!entry.isArchived)}
                      className="p-3 md:p-2 text-muted-text hover:text-primary-text hover:bg-background/50 rounded transition-colors"
                      title={showArchived ? "Unarchive" : "Archive"}
                    >
                      {showArchived ? (
                        <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 md:h-4 md:w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 10h10a8 8 0 018 8v2M3 10l6 6m-6-6l6-6" />
                        </svg>
                      ) : (
                        <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 md:h-4 md:w-4" viewBox="0 0 20 20" fill="currentColor">
                          <path d="M4 3a2 2 0 100 4h12a2 2 0 100-4H4z" />
                          <path fillRule="evenodd" d="M3 8h14v7a2 2 0 01-2 2H5a2 2 0 01-2-2V8zm5 3a1 1 0 011-1h2a1 1 0 110 2H9a1 1 0 01-1-1z" clipRule="evenodd" />
                        </svg>
                      )}
                    </button>
                  </div>
                )}
              </div>
              
              {editingEntryId !== entry.id && (
                <>
                  {entry.tags && entry.tags.length > 0 && (
                    <div className="flex flex-wrap gap-1 mt-1.5 mb-1">
                      {entry.tags.map(tag => (
                        <span key={tag} className="text-[10px] font-mono bg-background/50 text-muted-text px-1.5 py-0.5 rounded border border-hairline/50">
                          #{tag}
                        </span>
                      ))}
                    </div>
                  )}
                  <p className="text-xs md:text-sm text-muted-text truncate mt-1 tracking-wide">
                    {getSnippet(entry)}
                  </p>
                </>
              )}
            </div>
          ))}
        </div>
      )}
      
      {unpinnedEntries.length > 0 && (
        <div className="space-y-0.5">
          <div className="px-2 pb-1">
            <span className="text-[10px] font-mono tracking-[0.2em] text-muted-text uppercase">Recent</span>
          </div>
          {unpinnedEntries.map((entry) => (
            <div
              key={entry.id}
              onClick={() => {
                if (editingEntryId !== entry.id) {
                  setActiveEntryId(entry.id);
                  setIsMobileMenuOpen(false);
                }
              }}
              className={`group relative w-full text-left p-2.5 md:p-3.5 rounded-xl transition-all cursor-pointer border-l-2 ${
                activeEntryId === entry.id
                  ? 'bg-primary-accent/5 border-primary-accent'
                  : 'hover:bg-card border-transparent'
              }`}
            >
              <div className="flex items-start justify-between mb-2">
                <div className="flex flex-wrap gap-1.5">
                  {entry.results?.map((res: any, idx: number) => (
                    <span key={idx} className={`font-mono text-[10px] tracking-widest uppercase px-1.5 py-0.5 rounded-sm flex items-center gap-1 ${getBadgeStyle(res.type)}`}>
                      {res.type === 'note' && (
                        <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" /></svg>
                      )}
                      {res.type === 'tasks' && (
                        <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9l2 2 4-4" /></svg>
                      )}
                      {res.type === 'table' && (
                        <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 10h18M3 14h18m-9-4v8m-7 0h14a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z" /></svg>
                      )}
                      {res.type === 'tasks' ? 'TASK' : res.type?.toUpperCase() || 'UNKNOWN'}
                    </span>
                  ))}
                </div>
                <span className="font-mono text-muted-text text-[10px] tracking-wide shrink-0 ml-2 mt-0.5">
                  {formatDate(entry.createdAt)}
                </span>
              </div>

              <div className="flex items-center justify-between gap-2 mt-0.5">
                <div className="flex-1 min-w-0">
                  {editingEntryId === entry.id ? (
                    <input
                      type="text"
                      autoFocus
                      value={editingTitle}
                      onChange={(e) => setEditingTitle(e.target.value)}
                      onKeyDown={(e) => handleRenameKeyDown(e, entry.id)}
                      onBlur={() => saveRename(entry.id)}
                      onClick={(e) => e.stopPropagation()}
                      className="w-full font-serif italic font-bold text-lg md:text-xl text-primary-text bg-background border border-hairline rounded px-2 py-1 outline-none focus:border-primary-accent"
                    />
                  ) : (
                    <h3 className="font-serif italic font-bold text-lg md:text-xl text-primary-text truncate tracking-tight">
                      {entry.results?.[0]?.title || 'Untitled'}
                    </h3>
                  )}
                </div>

                {/* Actions (Always visible on mobile, hover on desktop) */}
                {editingEntryId !== entry.id && (
                  <div className="shrink-0 flex items-center gap-1 opacity-100 md:opacity-0 md:group-hover:opacity-100 transition-opacity">
                    <button
                      type="button"
                      onClick={(e) => handleTogglePin(e, entry.id, !!entry.pinned)}
                      className={`p-3 md:p-2 rounded transition-colors ${entry.pinned ? 'text-primary-accent' : 'text-muted-text hover:text-primary-text hover:bg-background/50'}`}
                      title={entry.pinned ? "Unpin" : "Pin"}
                    >
                      <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 md:h-4 md:w-4" viewBox="0 0 20 20" fill="currentColor">
                        <path fillRule="evenodd" d="M10 2a1 1 0 011 1v1h2a2 2 0 012 2v2l2 3v2h-6v4.5a.5.5 0 01-1 0V13H4v-2l2-3V6a2 2 0 012-2h2V3a1 1 0 011-1z" clipRule="evenodd" />
                      </svg>
                    </button>
                    <button
                      type="button"
                      onClick={(e) => startRename(e, entry.id, entry.results?.[0]?.title)}
                      className="p-3 md:p-2 text-muted-text hover:text-primary-text hover:bg-background/50 rounded transition-colors"
                      title="Rename"
                    >
                      <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 md:h-4 md:w-4" viewBox="0 0 20 20" fill="currentColor">
                        <path d="M13.586 3.586a2 2 0 112.828 2.828l-.793.793-2.828-2.828.793-.793zM11.379 5.793L3 14.172V17h2.828l8.38-8.379-2.83-2.828z" />
                      </svg>
                    </button>
                    <button
                      type="button"
                      onClick={(e) => handleDelete(e, entry.id)}
                      className="p-3 md:p-2 text-muted-text hover:text-red-400 hover:bg-background/50 rounded transition-colors"
                      title="Delete"
                    >
                      <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 md:h-4 md:w-4" viewBox="0 0 20 20" fill="currentColor">
                        <path fillRule="evenodd" d="M9 2a1 1 0 00-.894.553L7.382 4H4a1 1 0 000 2v10a2 2 0 002 2h8a2 2 0 002-2V6a1 1 0 100-2h-3.382l-.724-1.447A1 1 0 0011 2H9zM7 8a1 1 0 012 0v6a1 1 0 11-2 0V8zm5-1a1 1 0 00-1 1v6a1 1 0 102 0V8a1 1 0 00-1-1z" clipRule="evenodd" />
                      </svg>
                    </button>
                    <button
                      type="button"
                      onClick={(e) => handleArchiveToggle(e, entry.id, !!entry.isArchived)}
                      className="p-3 md:p-2 text-muted-text hover:text-primary-text hover:bg-background/50 rounded transition-colors"
                      title={showArchived ? "Unarchive" : "Archive"}
                    >
                      {showArchived ? (
                        <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 md:h-4 md:w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 10h10a8 8 0 018 8v2M3 10l6 6m-6-6l6-6" />
                        </svg>
                      ) : (
                        <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 md:h-4 md:w-4" viewBox="0 0 20 20" fill="currentColor">
                          <path d="M4 3a2 2 0 100 4h12a2 2 0 100-4H4z" />
                          <path fillRule="evenodd" d="M3 8h14v7a2 2 0 01-2 2H5a2 2 0 01-2-2V8zm5 3a1 1 0 011-1h2a1 1 0 110 2H9a1 1 0 01-1-1z" clipRule="evenodd" />
                        </svg>
                      )}
                    </button>
                  </div>
                )}
              </div>
              
              {editingEntryId !== entry.id && (
                <>
                  {entry.tags && entry.tags.length > 0 && (
                    <div className="flex flex-wrap gap-1 mt-1.5 mb-1">
                      {entry.tags.map(tag => (
                        <span key={tag} className="text-[10px] font-mono bg-background/50 text-muted-text px-1.5 py-0.5 rounded border border-hairline/50">
                          #{tag}
                        </span>
                      ))}
                    </div>
                  )}
                  <p className="text-xs md:text-sm text-muted-text truncate mt-1 tracking-wide">
                    {getSnippet(entry)}
                  </p>
                </>
              )}
            </div>
          ))}
        </div>
      )}
    </>
  );
}
