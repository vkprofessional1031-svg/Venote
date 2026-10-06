import React, { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabase';
import { useToast } from './ToastProvider';
import { deleteForever, daysLeft, TRASH_DAYS } from '@/utils/trash';
import { getSnippet, getBadgeStyle } from './EntriesList';

interface TrashedItem {
  id: string;
  type: 'entry' | 'quick_note';
  title: string;
  preview: string;
  badgeType?: string;
  deletedAt: string;
  rawItem: any;
}

export function TrashList({ userId, onRestore, onEmpty }: { userId: string, onRestore: () => void, onEmpty: () => void }) {
  const [items, setItems] = useState<TrashedItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [confirmEmpty, setConfirmEmpty] = useState(false);
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);
  const { showToast } = useToast();

  const fetchTrash = async () => {
    setLoading(true);
    try {
      const [{ data: entries }, { data: notes }] = await Promise.all([
        supabase.from('entries').select('*').eq('user_id', userId).not('deleted_at', 'is', null).order('deleted_at', { ascending: false }),
        supabase.from('quick_notes').select('*').eq('user_id', userId).not('deleted_at', 'is', null).order('deleted_at', { ascending: false })
      ]);

      const trashedItems: TrashedItem[] = [];

      entries?.forEach(e => {
        let title = 'Untitled Note';
        let badgeType = undefined;
        if (e.results && e.results.length > 0) {
           const first = e.results[0];
           title = first.title || 'Untitled Note';
           badgeType = first.type;
        }
        trashedItems.push({
          id: e.id,
          type: 'entry',
          title,
          preview: getSnippet(e),
          badgeType,
          deletedAt: e.deleted_at,
          rawItem: e
        });
      });

      notes?.forEach(n => {
        trashedItems.push({
          id: n.id,
          type: 'quick_note',
          title: n.title || 'Untitled Note',
          preview: n.body ? n.body : '',
          deletedAt: n.deleted_at,
          rawItem: n
        });
      });

      trashedItems.sort((a, b) => new Date(b.deletedAt).getTime() - new Date(a.deletedAt).getTime());
      setItems(trashedItems);
    } catch (e) {
      console.error(e);
      showToast('Failed to load trash', 'error');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchTrash();
  }, [userId]);

  const handleRestore = async (item: TrashedItem) => {
    const table = item.type === 'entry' ? 'entries' : 'quick_notes';
    const { error } = await supabase.from(table).update({ deleted_at: null }).eq('id', item.id);
    if (!error) {
      showToast('Item restored');
      setItems(prev => prev.filter(i => i.id !== item.id));
      onRestore();
    } else {
      showToast('Failed to restore item', 'error');
    }
  };

  const handleDeleteForever = async (item: TrashedItem) => {
    if (confirmDeleteId !== item.id) {
      setConfirmDeleteId(item.id);
      setTimeout(() => {
        setConfirmDeleteId(null);
      }, 4000);
      return;
    }

    const table = item.type === 'entry' ? 'entries' : 'quick_notes';
    await deleteForever(supabase, userId, table, [item.rawItem]);
    showToast('Deleted forever');
    setItems(prev => prev.filter(i => i.id !== item.id));
    setConfirmDeleteId(null);
  };

  const handleEmptyTrash = async () => {
    if (!confirmEmpty) {
      setConfirmEmpty(true);
      setTimeout(() => {
        setConfirmEmpty(false);
      }, 4000);
      return;
    }

    const entries = items.filter(i => i.type === 'entry').map(i => i.rawItem);
    const notes = items.filter(i => i.type === 'quick_note').map(i => i.rawItem);

    if (entries.length > 0) await deleteForever(supabase, userId, 'entries', entries);
    if (notes.length > 0) await deleteForever(supabase, userId, 'quick_notes', notes);
    
    setItems([]);
    showToast('Trash emptied');
    setConfirmEmpty(false);
    onEmpty();
  };

  return (
    <div className="w-full h-full flex flex-col min-h-0">
      <div className="flex flex-col gap-3 mb-6 px-4 shrink-0">
        <p className="text-[12px] leading-snug text-muted-text max-h-[3em] overflow-hidden">
          Items are permanently deleted after {TRASH_DAYS} days.
        </p>
        {items.length > 0 && (
          <button
            onClick={handleEmptyTrash}
            className={`w-full h-9 text-sm px-4 rounded-lg transition-colors border ${
              confirmEmpty 
                ? 'bg-red-500 text-white border-red-500' 
                : 'text-red-400 border-red-400 hover:bg-red-400/10'
            }`}
          >
            {confirmEmpty ? 'Confirm?' : 'Empty Trash'}
          </button>
        )}
      </div>

      <div className="flex-1 overflow-y-auto overflow-x-hidden min-h-0" data-trash-list>
        {loading ? (
          <div className="text-center py-12 text-muted-text flex items-center justify-center h-full">Loading trash...</div>
        ) : items.length === 0 ? (
          <div className="text-center py-12 text-muted-text flex items-center justify-center h-full">Trash is empty</div>
        ) : (
          <div className="flex flex-col gap-2 px-4 pb-6">
            {items.map(item => {
              const dLeft = daysLeft(item.deletedAt);
              const daysAgo = Math.max(0, TRASH_DAYS - dLeft);
              return (
                <div key={item.id} className="w-full box-border p-3 flex flex-col gap-2 min-w-0 bg-background border border-primary-accent/30 rounded-xl">
                  {/* Row 1: Badge & Deleted time */}
                  <div className="flex items-center justify-between min-w-0">
                    <div className="min-w-0 pr-2">
                      {item.type === 'entry' && item.badgeType ? (
                        <span className={`font-mono text-[10px] tracking-widest uppercase px-1.5 py-0.5 rounded-sm flex items-center gap-1 w-fit ${getBadgeStyle(item.badgeType)}`}>
                          {item.badgeType === 'tasks' ? 'TASK' : item.badgeType.toUpperCase()}
                        </span>
                      ) : (
                        <div className="h-4"></div> /* spacer so it aligns if no badge */
                      )}
                    </div>
                    <span className="text-[11px] text-muted-text shrink-0">
                      Deleted {daysAgo}d ago
                    </span>
                  </div>

                  {/* Row 2: Title */}
                  <div className="min-w-0">
                    <p className="text-primary-text text-sm font-medium truncate">
                      {item.title}
                    </p>
                  </div>

                  {/* Row 3: Preview */}
                  {item.preview && (
                    <div className="min-w-0">
                      <p className="text-muted-text text-sm line-clamp-2">
                        {item.preview}
                      </p>
                    </div>
                  )}

                  {/* Row 4: Permanently deleted in... */}
                  <div className="min-w-0">
                    <p className="text-[11px] text-muted-text">
                      Permanently deleted in {dLeft} days
                    </p>
                  </div>

                  {/* Row 5: Actions grid */}
                  <div className="grid grid-cols-2 gap-2 mt-1 min-w-0">
                    <button
                      onClick={() => handleRestore(item)}
                      className="h-10 px-2 min-w-0 whitespace-nowrap text-xs font-medium text-primary-text bg-white/5 hover:bg-white/10 rounded-lg transition-colors flex items-center justify-center"
                    >
                      Restore
                    </button>
                    <button
                      onClick={() => handleDeleteForever(item)}
                      className={`h-10 px-2 min-w-0 whitespace-nowrap text-xs font-medium rounded-lg transition-colors flex items-center justify-center border ${
                        confirmDeleteId === item.id 
                          ? 'bg-red-500 text-white border-red-500' 
                          : 'text-red-400 border-red-400 hover:bg-red-400/10'
                      }`}
                    >
                      {confirmDeleteId === item.id ? 'Confirm?' : 'Delete forever'}
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
