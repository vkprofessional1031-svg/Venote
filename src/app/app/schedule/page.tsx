'use client';

import React, { useState, useEffect, useRef, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import { supabase } from '@/lib/supabase';
import AppSidebar from '@/components/AppSidebar';
import AppMobileHeader from '@/components/AppMobileHeader';
import { useToast } from '@/components/ToastProvider';

interface ScheduleBlock {
  id: string;
  user_id: string;
  title: string;
  start_time: string; // ISO string
  end_time: string;   // ISO string
  notes?: string | null;
  color?: string | null;
  linked_task_id?: string | null;
  linked_round_id?: string | null;
  notified_at?: string | null;
  created_at?: string;
  updated_at?: string;
}

interface UnscheduledItem {
  id: string;
  type: 'task' | 'round';
  title: string;
  subtitle?: string;
  dueDate?: string | null;
  rawSourceId: string; // entry id or application_rounds id
  isScheduled: boolean;
  scheduledBlockId?: string;
}

const HOUR_HEIGHT = 64; // pixels per hour
const HOURS = Array.from({ length: 24 }, (_, i) => i);
const DEFAULT_START_HOUR = 7; // Auto scroll to 7 AM

const COLOR_PALETTES = [
  { label: 'Coral', value: '#FF5C38', bg: 'bg-[#FF5C38]/20', border: 'border-[#FF5C38]', text: 'text-[#FF5C38]', dot: 'bg-[#FF5C38]' },
  { label: 'Indigo', value: '#8B5CF6', bg: 'bg-[#8B5CF6]/20', border: 'border-[#8B5CF6]', text: 'text-[#8B5CF6]', dot: 'bg-[#8B5CF6]' },
  { label: 'Cyan', value: '#0EA5E9', bg: 'bg-[#0EA5E9]/20', border: 'border-[#0EA5E9]', text: 'text-[#0EA5E9]', dot: 'bg-[#0EA5E9]' },
  { label: 'Emerald', value: '#10B981', bg: 'bg-[#10B981]/20', border: 'border-[#10B981]', text: 'text-[#10B981]', dot: 'bg-[#10B981]' },
  { label: 'Amber', value: '#F59E0B', bg: 'bg-[#F59E0B]/20', border: 'border-[#F59E0B]', text: 'text-[#F59E0B]', dot: 'bg-[#F59E0B]' },
  { label: 'Rose', value: '#F43F5E', bg: 'bg-[#F43F5E]/20', border: 'border-[#F43F5E]', text: 'text-[#F43F5E]', dot: 'bg-[#F43F5E]' },
];

export default function SchedulePage() {
  const router = useRouter();
  const { showToast } = useToast();
  const scrollContainerRef = useRef<HTMLDivElement>(null);
  const mobileScrollContainerRef = useRef<HTMLDivElement>(null);

  // Auth & UI State
  const [session, setSession] = useState<any>(null);
  const [authLoading, setAuthLoading] = useState(true);
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [isSidebarOpen, setIsSidebarOpen] = useState(true); // Desktop unscheduled sidebar panel
  const [isMobileSheetOpen, setIsMobileSheetOpen] = useState(false); // Mobile unscheduled bottom sheet
  const [sidebarFilter, setSidebarFilter] = useState<'all' | 'prep' | 'task'>('all');

  // Calendar State
  const [currentWeekStart, setCurrentWeekStart] = useState<Date>(() => {
    const d = new Date();
    const day = d.getDay();
    const diff = d.getDate() - day + (day === 0 ? -6 : 1); // Monday as start of week
    const monday = new Date(d.setDate(diff));
    monday.setHours(0, 0, 0, 0);
    return monday;
  });

  // Mobile Single Day View State
  const [selectedMobileDate, setSelectedMobileDate] = useState<Date>(() => {
    const d = new Date();
    d.setHours(0, 0, 0, 0);
    return d;
  });

  // Tap-to-place pending item for touch screens / mobile
  const [pendingPlacementItem, setPendingPlacementItem] = useState<UnscheduledItem | null>(null);

  // Data State
  const [blocks, setBlocks] = useState<ScheduleBlock[]>([]);
  const [unscheduledItems, setUnscheduledItems] = useState<UnscheduledItem[]>([]);
  const [loading, setLoading] = useState(true);

  // Modal / Editing State
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingBlock, setEditingBlock] = useState<Partial<ScheduleBlock> | null>(null);
  const [isNewBlock, setIsNewBlock] = useState(false);

  // Resizing state
  const [resizingBlockId, setResizingBlockId] = useState<string | null>(null);
  const resizeStartYRef = useRef<number>(0);
  const resizeInitialMinutesRef = useRef<number>(60);

  // Initial Auth
  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
      setAuthLoading(false);
      if (!session) router.push('/login');
    });

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setSession(session);
      if (!session) router.push('/login');
    });

    return () => subscription.unsubscribe();
  }, [router]);

  // Initial Scroll to 7 AM
  useEffect(() => {
    if (scrollContainerRef.current) {
      scrollContainerRef.current.scrollTop = DEFAULT_START_HOUR * HOUR_HEIGHT;
    }
    if (mobileScrollContainerRef.current) {
      mobileScrollContainerRef.current.scrollTop = DEFAULT_START_HOUR * HOUR_HEIGHT;
    }
  }, []);

  // Fetch Schedule Blocks & Unscheduled Sources
  const fetchData = async () => {
    if (!session?.user?.id) return;
    try {
      setLoading(true);

      // 1. Fetch Schedule Blocks
      const { data: blocksData, error: blocksError } = await supabase
        .from('schedule_blocks')
        .select('*')
        .eq('user_id', session.user.id);

      if (blocksError) throw blocksError;
      const loadedBlocks: ScheduleBlock[] = blocksData || [];
      setBlocks(loadedBlocks);

      const extractedItems: UnscheduledItem[] = [];
      const matchedBlockIds = new Set<string>();

      // 1. Fetch Prep Rounds
      const { data: roundsData, error: roundsError } = await supabase
        .from('application_rounds')
        .select('*, application:job_applications(company, role)')
        .eq('user_id', session.user.id)
        .order('deadline', { ascending: true, nullsFirst: false });

      if (!roundsError && roundsData) {
        roundsData.forEach((round: any) => {
          if (round.status !== 'completed' && round.status !== 'passed' && round.status !== 'rejected') {
            const companyName = round.application?.company || 'Prep Application';
            const title = `${companyName} — ${round.round_name || 'Interview'}`;
            
            // Match against block linked to this specific round
            const matchingBlock = loadedBlocks.find(b => b.linked_round_id === round.id && !matchedBlockIds.has(b.id));
            if (matchingBlock) {
              matchedBlockIds.add(matchingBlock.id);
            }

            extractedItems.push({
              id: `round-${round.id}`,
              type: 'round',
              title: title,
              subtitle: round.notes || (round.deadline ? `Due ${new Date(round.deadline).toLocaleDateString()}` : undefined),
              dueDate: round.deadline,
              rawSourceId: round.id,
              isScheduled: !!matchingBlock,
              scheduledBlockId: matchingBlock?.id
            });
          }
        });
      }

      // 2. Fetch Organize Tasks
      const { data: entriesData, error: entriesError } = await supabase
        .from('entries')
        .select('*')
        .eq('user_id', session.user.id)
        .eq('is_archived', false)
        .order('created_at', { ascending: false });

      if (!entriesError && entriesData) {
        entriesData.forEach((entry: any) => {
          if (!entry.results || !Array.isArray(entry.results)) return;
          const entryTitle = entry.results[0]?.title || 'Note';

          // Get all blocks linked to this entry that haven't been claimed yet
          const entryLinkedBlocks = loadedBlocks.filter(b => b.linked_task_id === entry.id && !matchedBlockIds.has(b.id));
          const availableBlocks = [...entryLinkedBlocks];

          // Collect all non-done tasks in this entry
          const entryTasks: Array<{
            uniqueTaskId: string;
            text: string;
            dueDate: string | null;
          }> = [];

          entry.results.forEach((res: any, rIdx: number) => {
            if (res.type === 'tasks' && Array.isArray(res.items)) {
              res.items.forEach((task: any, tIdx: number) => {
                if (!task.done) {
                  entryTasks.push({
                    uniqueTaskId: `${entry.id}-${rIdx}-${tIdx}`,
                    text: (task.text || 'Untitled Task').trim(),
                    dueDate: task.dueDate || null
                  });
                }
              });
            } else if (res.embeddedTasks && Array.isArray(res.embeddedTasks)) {
              res.embeddedTasks.forEach((task: any, tIdx: number) => {
                if (!task.done) {
                  entryTasks.push({
                    uniqueTaskId: `${entry.id}-emb-${rIdx}-${tIdx}`,
                    text: (task.text || 'Untitled Task').trim(),
                    dueDate: task.dueDate || null
                  });
                }
              });
            }
          });

          // Match each task individually to a linked block
          entryTasks.forEach(task => {
            // First pass: exact title match (case-insensitive)
            let matchedBlockIndex = availableBlocks.findIndex(
              b => b.title.trim().toLowerCase() === task.text.toLowerCase()
            );

            // Second pass: if only 1 task in entry and 1 block linked to this entry
            if (matchedBlockIndex === -1 && availableBlocks.length === 1 && entryTasks.length === 1) {
              matchedBlockIndex = 0;
            }

            let matchedBlock: ScheduleBlock | undefined = undefined;
            if (matchedBlockIndex !== -1) {
              matchedBlock = availableBlocks[matchedBlockIndex];
              availableBlocks.splice(matchedBlockIndex, 1);
              matchedBlockIds.add(matchedBlock.id);
            }

            extractedItems.push({
              id: `task-${task.uniqueTaskId}`,
              type: 'task',
              title: task.text,
              subtitle: entryTitle !== 'Note' ? entryTitle : undefined,
              dueDate: task.dueDate,
              rawSourceId: entry.id,
              isScheduled: !!matchedBlock,
              scheduledBlockId: matchedBlock?.id
            });
          });
        });
      }

      setUnscheduledItems(extractedItems);
    } catch (err: any) {
      console.error('Error loading schedule data:', err);
      showToast(err.message || 'Failed to load schedule data', 'error');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (session?.user?.id) {
      fetchData();
    }
  }, [session?.user?.id]);

  // Week Days Array
  const weekDays = useMemo(() => {
    return Array.from({ length: 7 }, (_, i) => {
      const d = new Date(currentWeekStart);
      d.setDate(d.getDate() + i);
      return d;
    });
  }, [currentWeekStart]);

  // Week Range Header Text
  const weekRangeText = useMemo(() => {
    const end = new Date(weekDays[6]);
    const startStr = currentWeekStart.toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
    const endStr = end.toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' });
    return `${startStr} – ${endStr}`;
  }, [currentWeekStart, weekDays]);

  // Navigation handlers
  const handlePrevWeek = () => {
    const d = new Date(currentWeekStart);
    d.setDate(d.getDate() - 7);
    setCurrentWeekStart(d);
  };

  const handleNextWeek = () => {
    const d = new Date(currentWeekStart);
    d.setDate(d.getDate() + 7);
    setCurrentWeekStart(d);
  };

  const handleToday = () => {
    const d = new Date();
    const day = d.getDay();
    const diff = d.getDate() - day + (day === 0 ? -6 : 1);
    const monday = new Date(d.setDate(diff));
    monday.setHours(0, 0, 0, 0);
    setCurrentWeekStart(monday);
  };

  // Mobile Single Day Navigation handlers
  const handleMobilePrevDay = () => {
    setSelectedMobileDate(prev => {
      const d = new Date(prev);
      d.setDate(d.getDate() - 1);
      // Sync currentWeekStart if day moves to previous week
      const weekStart = new Date(currentWeekStart);
      const weekEnd = new Date(currentWeekStart);
      weekEnd.setDate(weekEnd.getDate() + 6);
      if (d < weekStart || d > weekEnd) {
        const day = d.getDay();
        const diff = d.getDate() - day + (day === 0 ? -6 : 1);
        const newMon = new Date(d);
        newMon.setDate(diff);
        newMon.setHours(0, 0, 0, 0);
        setCurrentWeekStart(newMon);
      }
      return d;
    });
  };

  const handleMobileNextDay = () => {
    setSelectedMobileDate(prev => {
      const d = new Date(prev);
      d.setDate(d.getDate() + 1);
      // Sync currentWeekStart if day moves to next week
      const weekStart = new Date(currentWeekStart);
      const weekEnd = new Date(currentWeekStart);
      weekEnd.setDate(weekEnd.getDate() + 6);
      if (d < weekStart || d > weekEnd) {
        const day = d.getDay();
        const diff = d.getDate() - day + (day === 0 ? -6 : 1);
        const newMon = new Date(d);
        newMon.setDate(diff);
        newMon.setHours(0, 0, 0, 0);
        setCurrentWeekStart(newMon);
      }
      return d;
    });
  };

  const handleMobileToday = () => {
    const d = new Date();
    d.setHours(0, 0, 0, 0);
    setSelectedMobileDate(d);
    handleToday();
  };

  // Helper: check if a date is today
  const isDateToday = (d: Date) => {
    const now = new Date();
    return d.getDate() === now.getDate() && d.getMonth() === now.getMonth() && d.getFullYear() === now.getFullYear();
  };

  // Map blocks to each day
  const blocksByDay = useMemo(() => {
    const map = new Map<string, ScheduleBlock[]>();
    weekDays.forEach(d => {
      const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
      map.set(key, []);
    });

    const mobileKey = `${selectedMobileDate.getFullYear()}-${String(selectedMobileDate.getMonth() + 1).padStart(2, '0')}-${String(selectedMobileDate.getDate()).padStart(2, '0')}`;
    if (!map.has(mobileKey)) {
      map.set(mobileKey, []);
    }

    blocks.forEach(block => {
      const blockStart = new Date(block.start_time);
      const key = `${blockStart.getFullYear()}-${String(blockStart.getMonth() + 1).padStart(2, '0')}-${String(blockStart.getDate()).padStart(2, '0')}`;
      if (map.has(key)) {
        map.get(key)!.push(block);
      } else {
        map.set(key, [block]);
      }
    });

    return map;
  }, [blocks, weekDays, selectedMobileDate]);

  // Filtered Unscheduled Items
  const filteredUnscheduled = useMemo(() => {
    if (sidebarFilter === 'all') return unscheduledItems;
    if (sidebarFilter === 'prep') return unscheduledItems.filter(i => i.type === 'round');
    if (sidebarFilter === 'task') return unscheduledItems.filter(i => i.type === 'task');
    return unscheduledItems;
  }, [unscheduledItems, sidebarFilter]);

  // Handle Drag & Drop
  const handleDragStartUnscheduled = (e: React.DragEvent, item: UnscheduledItem) => {
    e.dataTransfer.setData('application/json', JSON.stringify({ kind: 'unscheduled', item }));
    e.dataTransfer.effectAllowed = 'copy';
  };

  const handleDragStartBlock = (e: React.DragEvent, block: ScheduleBlock) => {
    e.dataTransfer.setData('application/json', JSON.stringify({ kind: 'block', block }));
    e.dataTransfer.effectAllowed = 'move';
  };

  const handleDropOnSlot = async (dayDate: Date, hour: number, e: React.DragEvent) => {
    e.preventDefault();
    try {
      const rawData = e.dataTransfer.getData('application/json');
      if (!rawData) return;
      const parsed = JSON.parse(rawData);

      const slotStart = new Date(dayDate.getFullYear(), dayDate.getMonth(), dayDate.getDate(), hour, 0, 0);
      const slotEnd = new Date(dayDate.getFullYear(), dayDate.getMonth(), dayDate.getDate(), hour + 1, 0, 0);

      if (parsed.kind === 'unscheduled') {
        const item: UnscheduledItem = parsed.item;
        const color = item.type === 'round' ? '#8B5CF6' : '#10B981';

        const insertPayload: any = {
          user_id: session.user.id,
          title: item.title,
          start_time: slotStart.toISOString(),
          end_time: slotEnd.toISOString(),
          notes: item.subtitle || null,
          color: color,
        };

        if (item.type === 'round') {
          insertPayload.linked_round_id = item.rawSourceId;
        } else if (item.type === 'task') {
          // If valid UUID, set linked_task_id
          if (item.rawSourceId && item.rawSourceId.length === 36) {
            insertPayload.linked_task_id = item.rawSourceId;
          }
        }

        const { data: newBlock, error } = await supabase
          .from('schedule_blocks')
          .insert(insertPayload)
          .select()
          .single();

        if (error) throw error;
        setBlocks(prev => [...prev, newBlock]);
        showToast(`Scheduled "${item.title}"`, 'success');
        fetchData(); // Refresh links and statuses
      } else if (parsed.kind === 'block') {
        const existingBlock: ScheduleBlock = parsed.block;
        const oldStart = new Date(existingBlock.start_time);
        const oldEnd = new Date(existingBlock.end_time);
        const durationMs = Math.max(15 * 60 * 1000, oldEnd.getTime() - oldStart.getTime());

        const newStart = slotStart;
        const newEnd = new Date(newStart.getTime() + durationMs);

        const { data: updatedBlock, error } = await supabase
          .from('schedule_blocks')
          .update({
            start_time: newStart.toISOString(),
            end_time: newEnd.toISOString(),
            updated_at: new Date().toISOString()
          })
          .eq('id', existingBlock.id)
          .select()
          .single();

        if (error) throw error;
        setBlocks(prev => prev.map(b => b.id === existingBlock.id ? updatedBlock : b));
        showToast('Rescheduled time block', 'success');
      }
    } catch (err: any) {
      console.error('Error on drop:', err);
      showToast(err.message || 'Failed to place item', 'error');
    }
  };

  // Click empty slot to create block or place pending item
  const handleSlotClick = async (dayDate: Date, hour: number) => {
    // If an unscheduled item was selected in tap-to-place mode
    if (pendingPlacementItem) {
      const slotStart = new Date(dayDate.getFullYear(), dayDate.getMonth(), dayDate.getDate(), hour, 0, 0);
      const slotEnd = new Date(dayDate.getFullYear(), dayDate.getMonth(), dayDate.getDate(), hour + 1, 0, 0);
      const color = pendingPlacementItem.type === 'round' ? '#8B5CF6' : '#10B981';

      try {
        const insertPayload: any = {
          user_id: session.user.id,
          title: pendingPlacementItem.title,
          start_time: slotStart.toISOString(),
          end_time: slotEnd.toISOString(),
          notes: pendingPlacementItem.subtitle || null,
          color: color,
        };

        if (pendingPlacementItem.type === 'round') {
          insertPayload.linked_round_id = pendingPlacementItem.rawSourceId;
        } else if (pendingPlacementItem.type === 'task' && pendingPlacementItem.rawSourceId.length === 36) {
          insertPayload.linked_task_id = pendingPlacementItem.rawSourceId;
        }

        const { data: newBlock, error } = await supabase
          .from('schedule_blocks')
          .insert(insertPayload)
          .select()
          .single();

        if (error) throw error;
        setBlocks(prev => [...prev, newBlock]);
        showToast(`Scheduled "${pendingPlacementItem.title}" at ${hour % 12 || 12} ${hour >= 12 ? 'PM' : 'AM'}`, 'success');
        setPendingPlacementItem(null);
        fetchData();
        return;
      } catch (err: any) {
        console.error('Error placing pending item:', err);
        showToast(err.message || 'Failed to schedule item', 'error');
      }
    }

    const slotStart = new Date(dayDate.getFullYear(), dayDate.getMonth(), dayDate.getDate(), hour, 0, 0);
    const slotEnd = new Date(dayDate.getFullYear(), dayDate.getMonth(), dayDate.getDate(), hour + 1, 0, 0);

    setEditingBlock({
      title: '',
      start_time: slotStart.toISOString(),
      end_time: slotEnd.toISOString(),
      notes: '',
      color: '#FF5C38'
    });
    setIsNewBlock(true);
    setIsModalOpen(true);
  };

  // Click block to edit
  const handleBlockClick = (e: React.MouseEvent, block: ScheduleBlock) => {
    e.stopPropagation();
    setEditingBlock({ ...block });
    setIsNewBlock(false);
    setIsModalOpen(true);
  };

  // Save Block (Insert or Update)
  const handleSaveBlock = async () => {
    if (!editingBlock || !editingBlock.title?.trim()) {
      showToast('Please enter a title for the time block', 'error');
      return;
    }

    try {
      if (isNewBlock) {
        const { data, error } = await supabase
          .from('schedule_blocks')
          .insert({
            user_id: session.user.id,
            title: editingBlock.title.trim(),
            start_time: editingBlock.start_time,
            end_time: editingBlock.end_time,
            notes: editingBlock.notes || null,
            color: editingBlock.color || '#FF5C38',
            linked_task_id: editingBlock.linked_task_id || null,
            linked_round_id: editingBlock.linked_round_id || null
          })
          .select()
          .single();

        if (error) throw error;
        setBlocks(prev => [...prev, data]);
        showToast('Time block created', 'success');
      } else {
        const { data, error } = await supabase
          .from('schedule_blocks')
          .update({
            title: editingBlock.title.trim(),
            start_time: editingBlock.start_time,
            end_time: editingBlock.end_time,
            notes: editingBlock.notes || null,
            color: editingBlock.color || '#FF5C38',
            updated_at: new Date().toISOString()
          })
          .eq('id', editingBlock.id!)
          .select()
          .single();

        if (error) throw error;
        setBlocks(prev => prev.map(b => b.id === editingBlock.id ? data : b));
        showToast('Time block updated', 'success');
      }

      setIsModalOpen(false);
      setEditingBlock(null);
      fetchData();
    } catch (err: any) {
      console.error('Error saving block:', err);
      showToast(err.message || 'Failed to save block', 'error');
    }
  };

  // Delete Block (DOES NOT DELETE ORIGINAL SOURCE TASK OR ROUND)
  const handleDeleteBlock = async () => {
    if (!editingBlock?.id) return;
    try {
      const { error } = await supabase
        .from('schedule_blocks')
        .delete()
        .eq('id', editingBlock.id);

      if (error) throw error;

      setBlocks(prev => prev.filter(b => b.id !== editingBlock.id));
      showToast('Time block removed (original source untouched)', 'success');
      setIsModalOpen(false);
      setEditingBlock(null);
      fetchData();
    } catch (err: any) {
      console.error('Error deleting block:', err);
      showToast(err.message || 'Failed to delete block', 'error');
    }
  };

  // Quick Place Unscheduled Item
  const handleQuickPlaceItem = async (item: UnscheduledItem) => {
    // Find next reasonable slot today or current week
    const now = new Date();
    const targetDay = weekDays.find(d => isDateToday(d)) || weekDays[0];
    const hour = Math.min(22, Math.max(8, now.getHours() + 1));

    const slotStart = new Date(targetDay.getFullYear(), targetDay.getMonth(), targetDay.getDate(), hour, 0, 0);
    const slotEnd = new Date(targetDay.getFullYear(), targetDay.getMonth(), targetDay.getDate(), hour + 1, 0, 0);

    const color = item.type === 'round' ? '#8B5CF6' : '#10B981';

    try {
      const insertPayload: any = {
        user_id: session.user.id,
        title: item.title,
        start_time: slotStart.toISOString(),
        end_time: slotEnd.toISOString(),
        notes: item.subtitle || null,
        color: color
      };

      if (item.type === 'round') {
        insertPayload.linked_round_id = item.rawSourceId;
      } else if (item.type === 'task' && item.rawSourceId.length === 36) {
        insertPayload.linked_task_id = item.rawSourceId;
      }

      const { data, error } = await supabase
        .from('schedule_blocks')
        .insert(insertPayload)
        .select()
        .single();

      if (error) throw error;
      setBlocks(prev => [...prev, data]);
      showToast(`Scheduled "${item.title}" for ${targetDay.toLocaleDateString(undefined, { weekday: 'short' })} at ${hour % 12 || 12} ${hour >= 12 ? 'PM' : 'AM'}`, 'success');
      fetchData();
    } catch (err: any) {
      console.error('Error placing item:', err);
      showToast(err.message || 'Failed to schedule item', 'error');
    }
  };

  // Real-time "now" line indicator position
  const now = new Date();
  const currentMinutesFromMidnight = now.getHours() * 60 + now.getMinutes();
  const nowLineTop = (currentMinutesFromMidnight / 60) * HOUR_HEIGHT;

  if (authLoading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="animate-spin rounded-full h-8 w-8 border-t-2 border-b-2 border-primary-accent"></div>
      </div>
    );
  }

  return (
    <div className="flex h-screen bg-background text-primary-text font-sans overflow-hidden">
      {/* App Main Sidebar */}
      <AppSidebar 
        activePath="/app/schedule"
        isMobileMenuOpen={isMobileMenuOpen} 
        onCloseMenu={() => setIsMobileMenuOpen(false)}
        session={session}
      />

      {/* Main Content Area */}
      <div className="flex-1 flex flex-col min-w-0 h-full overflow-hidden">
        {/* Mobile Header */}
        <AppMobileHeader onOpenMenu={() => setIsMobileMenuOpen(true)} />

        {/* Schedule Top Bar */}
        <header className="px-3 sm:px-4 md:px-8 py-3 md:py-3.5 border-b border-white/10 glass-panel-modal flex items-center justify-between gap-2 shrink-0 relative z-40">
          <div className="flex items-center gap-2 sm:gap-4 min-w-0">
            <div className="min-w-0">
              <h1 className="text-base sm:text-xl md:text-2xl font-serif font-bold text-primary-text flex items-center gap-1.5 sm:gap-2">
                <span>Schedule</span>
                <span className="text-[10px] sm:text-xs font-sans px-2 sm:px-2.5 py-0.5 rounded-full bg-primary-accent/15 text-primary-accent border border-primary-accent/30 font-medium whitespace-nowrap">
                  <span className="inline md:hidden">Day View</span>
                  <span className="hidden md:inline">Week View</span>
                </span>
              </h1>
              <p className="text-xs text-muted-text hidden md:block">Time-block your week with drag-and-drop</p>
            </div>

            {/* Desktop Navigation Controls (hidden on mobile) */}
            <div className="hidden md:flex items-center gap-1.5 bg-background/80 border border-hairline rounded-xl p-1 shadow-sm">
              <button
                onClick={handlePrevWeek}
                className="p-1.5 hover:bg-white/10 rounded-lg text-muted-text hover:text-primary-text transition-colors"
                title="Previous week"
              >
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
                </svg>
              </button>
              <button
                onClick={handleToday}
                className="px-2.5 py-1 text-xs font-semibold hover:bg-white/10 rounded-lg text-primary-text transition-colors"
              >
                Today
              </button>
              <button
                onClick={handleNextWeek}
                className="p-1.5 hover:bg-white/10 rounded-lg text-muted-text hover:text-primary-text transition-colors"
                title="Next week"
              >
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                </svg>
              </button>
            </div>

            <span className="text-sm font-semibold text-primary-text tracking-tight hidden lg:inline-block">
              {weekRangeText}
            </span>
          </div>

          {/* Right Action Controls */}
          <div className="flex items-center gap-1.5 sm:gap-2.5 shrink-0">
            {/* Add Block Button */}
            <button
              onClick={() => {
                const targetDay = selectedMobileDate || new Date();
                const now = new Date();
                const start = new Date(targetDay.getFullYear(), targetDay.getMonth(), targetDay.getDate(), 9, 0, 0);
                const end = new Date(targetDay.getFullYear(), targetDay.getMonth(), targetDay.getDate(), 10, 0, 0);
                setEditingBlock({
                  title: '',
                  start_time: start.toISOString(),
                  end_time: end.toISOString(),
                  notes: '',
                  color: '#FF5C38'
                });
                setIsNewBlock(true);
                setIsModalOpen(true);
              }}
              className="flex items-center gap-1.5 px-2.5 sm:px-3.5 py-2 bg-primary-accent text-white text-xs font-semibold rounded-xl hover:brightness-110 shadow-[0_4px_14px_0_rgba(255,92,56,0.39)] transition-all cursor-pointer shrink-0"
            >
              <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M12 4v16m8-8H4" />
              </svg>
              <span className="hidden sm:inline">Add Block</span>
            </button>

            {/* Unscheduled Toggle Button */}
            <button
              onClick={() => {
                if (typeof window !== 'undefined' && window.innerWidth < 768) {
                  setIsMobileSheetOpen(prev => !prev);
                } else {
                  setIsSidebarOpen(prev => !prev);
                }
              }}
              className={`flex items-center gap-1.5 px-2.5 sm:px-3 py-2 text-xs font-medium rounded-xl border transition-all cursor-pointer shrink-0 ${
                isSidebarOpen || isMobileSheetOpen
                  ? 'bg-primary-accent/10 border-primary-accent/30 text-primary-accent'
                  : 'bg-white/10 border-white/10 text-primary-text hover:brightness-110'
              }`}
              title="Toggle unscheduled panel"
            >
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 10h16M4 14h16M4 18h16" />
              </svg>
              <span className="hidden sm:inline">Unscheduled</span>
              {unscheduledItems.filter(i => !i.isScheduled).length > 0 && (
                <span className="w-4 h-4 rounded-full bg-primary-accent text-white text-[10px] flex items-center justify-center font-bold">
                  {unscheduledItems.filter(i => !i.isScheduled).length}
                </span>
              )}
            </button>
          </div>
        </header>

        {/* Mobile Day Navigation Bar (Visible only on mobile) */}
        <div className="flex md:hidden flex-col border-b border-white/10 glass-panel-modal shrink-0">
          {/* Day Navigation Row */}
          <div className="flex items-center justify-between px-3 py-2.5 gap-2">
            <div className="flex items-center gap-1 bg-background/80 border border-hairline rounded-lg p-0.5">
              <button
                onClick={handleMobilePrevDay}
                className="p-1.5 hover:bg-white/10 rounded-md text-muted-text hover:text-primary-text transition-colors"
                title="Previous day"
              >
                <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
                </svg>
              </button>
              <button
                onClick={handleMobileToday}
                className="px-2 py-0.5 text-xs font-semibold hover:bg-white/10 rounded-md text-primary-text transition-colors"
              >
                Today
              </button>
              <button
                onClick={handleMobileNextDay}
                className="p-1.5 hover:bg-white/10 rounded-md text-muted-text hover:text-primary-text transition-colors"
                title="Next day"
              >
                <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                </svg>
              </button>
            </div>

            <div className="flex items-center gap-1.5 min-w-0">
              <span className="text-xs sm:text-sm font-bold text-primary-text truncate">
                {selectedMobileDate.toLocaleDateString(undefined, { weekday: 'short', month: 'short', day: 'numeric' })}
              </span>
              {isDateToday(selectedMobileDate) && (
                <span className="text-[10px] px-1.5 py-0.2 rounded bg-primary-accent/15 text-primary-accent border border-primary-accent/30 font-semibold shrink-0">
                  Today
                </span>
              )}
            </div>
          </div>

          {/* Mini 7-Day Week Strip for quick jumping on mobile */}
          <div className="grid grid-cols-7 border-t border-hairline/60 divide-x divide-hairline/50 bg-background/40">
            {weekDays.map((day, idx) => {
              const isSelected = selectedMobileDate.getDate() === day.getDate() && selectedMobileDate.getMonth() === day.getMonth() && selectedMobileDate.getFullYear() === day.getFullYear();
              const isTodayDay = isDateToday(day);

              return (
                <button
                  key={idx}
                  onClick={() => {
                    const d = new Date(day);
                    d.setHours(0, 0, 0, 0);
                    setSelectedMobileDate(d);
                  }}
                  className={`py-1.5 px-0.5 text-center transition-all cursor-pointer ${
                    isSelected
                      ? 'bg-primary-accent/15 text-primary-accent'
                      : 'hover:bg-white/10 text-muted-text hover:text-primary-text'
                  }`}
                >
                  <div className="text-[9px] uppercase font-medium">
                    {day.toLocaleDateString(undefined, { weekday: 'narrow' })}
                  </div>
                  <div className="flex justify-center mt-0.5">
                    <span
                      className={`text-xs font-bold w-5 h-5 flex items-center justify-center rounded-full transition-all ${
                        isSelected
                          ? 'bg-primary-accent text-white shadow-sm'
                          : isTodayDay
                          ? 'text-primary-accent font-extrabold border border-primary-accent/50'
                          : 'text-primary-text'
                      }`}
                    >
                      {day.getDate()}
                    </span>
                  </div>
                </button>
              );
            })}
          </div>
        </div>

        {/* Pending Placement Banner (Mobile/Touch Tap-to-Place) */}
        {pendingPlacementItem && (
          <div className="px-4 py-2.5 bg-primary-accent/15 border-b border-primary-accent/30 flex items-center justify-between gap-2 z-30 shrink-0 animate-in fade-in duration-150">
            <div className="flex items-center gap-2 min-w-0">
              <span className="text-primary-accent text-sm animate-pulse shrink-0">📍</span>
              <p className="text-xs text-primary-text font-medium truncate">
                Tap any time slot to schedule: <span className="font-bold underline">{pendingPlacementItem.title}</span>
              </p>
            </div>
            <button
              onClick={() => setPendingPlacementItem(null)}
              className="px-2.5 py-1 text-[11px] rounded-lg bg-background/80 hover:bg-background text-muted-text hover:text-primary-text border border-hairline font-semibold transition-colors shrink-0"
            >
              Cancel
            </button>
          </div>
        )}

        {/* Main Workspace Body */}
        <div className="flex-1 flex min-h-0 relative overflow-hidden">
          {/* DESKTOP WEEK-VIEW GRID (Visible only on md screens and up) */}
          <div className="hidden md:flex flex-1 flex-col min-w-0 h-full overflow-hidden bg-background">
            {/* Days Header Row */}
            <div className="flex border-b border-white/10 glass-panel-modal shrink-0">
              {/* Time gutter placeholder */}
              <div className="w-14 sm:w-16 shrink-0 border-r border-hairline flex items-end justify-center pb-2 text-[10px] uppercase font-mono text-muted-text/60">
                GMT
              </div>

              {/* 7 Day Column Headers */}
              <div className="flex-1 grid grid-cols-7 divide-x divide-hairline">
                {weekDays.map((day, idx) => {
                  const isToday = isDateToday(day);
                  return (
                    <div
                      key={idx}
                      className={`py-2.5 px-1 sm:px-2 flex flex-col items-center justify-center transition-colors ${
                        isToday ? 'bg-primary-accent/5' : ''
                      }`}
                    >
                      <div className="text-[11px] sm:text-xs uppercase font-medium text-muted-text text-center">
                        {day.toLocaleDateString(undefined, { weekday: 'short' })}
                      </div>
                      <div className="flex items-center justify-center mt-0.5">
                        <span
                          className={`text-sm sm:text-base font-bold w-7 h-7 flex items-center justify-center rounded-full transition-all ${
                            isToday
                              ? 'bg-primary-accent text-white shadow-[0_0_10px_rgba(255,92,56,0.5)]'
                              : 'text-primary-text'
                          }`}
                        >
                          {day.getDate()}
                        </span>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Scrollable Hourly Calendar Grid (Desktop) */}
            <div 
              ref={scrollContainerRef}
              className="flex-1 overflow-y-auto overflow-x-hidden relative select-none scroll-smooth"
            >
              <div className="flex min-h-[1536px] relative">
                {/* Time Gutter Column */}
                <div className="w-14 sm:w-16 shrink-0 border-r border-hairline flex flex-col bg-background/50 sticky left-0 z-10 select-none">
                  {HOURS.map(hour => (
                    <div 
                      key={hour} 
                      style={{ height: `${HOUR_HEIGHT}px` }}
                      className="border-b border-hairline/40 text-right pr-2 pt-1 text-[11px] font-mono text-muted-text/70"
                    >
                      {hour === 0 ? '12 AM' : hour < 12 ? `${hour} AM` : hour === 12 ? '12 PM' : `${hour - 12} PM`}
                    </div>
                  ))}
                </div>

                {/* 7 Days Columns */}
                <div className="flex-1 grid grid-cols-7 divide-x divide-hairline relative">
                  {weekDays.map((dayDate, dayIdx) => {
                    const dayKey = `${dayDate.getFullYear()}-${String(dayDate.getMonth() + 1).padStart(2, '0')}-${String(dayDate.getDate()).padStart(2, '0')}`;
                    const dayBlocks = blocksByDay.get(dayKey) || [];
                    const isToday = isDateToday(dayDate);

                    return (
                      <div
                        key={dayIdx}
                        className={`relative flex flex-col transition-colors ${
                          isToday ? 'bg-primary-accent/[0.02]' : ''
                        }`}
                      >
                        {/* Current Time Red Indicator Line */}
                        {isToday && (
                          <div 
                            style={{ top: `${nowLineTop}px` }}
                            className="absolute left-1 right-0 z-[5] pointer-events-none -translate-y-1/2 flex items-center"
                          >
                            <div className="absolute left-0 w-2 h-2 rounded-full bg-red-500 shadow-[0_0_8px_rgba(239,68,68,0.9)] z-10"></div>
                            <div className="absolute left-1 right-0 h-[2px] bg-red-500 shadow-[0_0_8px_rgba(239,68,68,0.9)]"></div>
                          </div>
                        )}

                        {/* Hourly Clickable / Droppable Cells */}
                        {HOURS.map(hour => (
                          <div
                            key={hour}
                            style={{ height: `${HOUR_HEIGHT}px` }}
                            onClick={() => handleSlotClick(dayDate, hour)}
                            onDragOver={(e) => {
                              e.preventDefault();
                              e.currentTarget.classList.add('bg-primary-accent/15');
                            }}
                            onDragLeave={(e) => {
                              e.currentTarget.classList.remove('bg-primary-accent/15');
                            }}
                            onDrop={(e) => {
                              e.currentTarget.classList.remove('bg-primary-accent/15');
                              handleDropOnSlot(dayDate, hour, e);
                            }}
                            className="border-b border-white/5 hover:bg-white/5 cursor-pointer transition-colors relative group/slot"
                          >
                            {/* Subtle half-hour dotted guide */}
                            <div className="absolute top-1/2 left-0 right-0 border-b border-dashed border-hairline/20 pointer-events-none"></div>
                          </div>
                        ))}

                        {/* Rendered Time Blocks on Day Column */}
                        {dayBlocks.map(block => {
                          const blockStart = new Date(block.start_time);
                          const blockEnd = new Date(block.end_time);
                          const startMinutes = blockStart.getHours() * 60 + blockStart.getMinutes();
                          const durationMinutes = Math.max(15, (blockEnd.getTime() - blockStart.getTime()) / (1000 * 60));

                          const topPos = (startMinutes / 60) * HOUR_HEIGHT;
                          const heightPos = (durationMinutes / 60) * HOUR_HEIGHT;

                          const palette = COLOR_PALETTES.find(p => p.value === block.color) || COLOR_PALETTES[0];

                          const timeFormatted = `${blockStart.toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit' })} – ${blockEnd.toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit' })}`;

                          return (
                            <div
                              key={block.id}
                              draggable
                              onDragStart={(e) => handleDragStartBlock(e, block)}
                              onClick={(e) => handleBlockClick(e, block)}
                              style={{
                                top: `${topPos}px`,
                                height: `${Math.max(26, heightPos - 2)}px`,
                                borderLeftColor: block.color || '#FF5C38',
                              }}
                              className={`absolute left-1 right-1 rounded-lg border-l-4 border-t border-r border-b border-white/10 ${palette.bg} backdrop-blur-sm p-1.5 sm:p-2 shadow-md hover:shadow-lg transition-all group/block cursor-grab active:cursor-grabbing z-10 overflow-hidden flex flex-col justify-between`}
                            >
                              <div className="flex items-start justify-between gap-1 overflow-hidden leading-tight">
                                <div className="truncate">
                                  <div className="text-xs font-bold text-primary-text truncate">
                                    {block.title}
                                  </div>
                                  <div className="text-[10px] text-muted-text font-mono truncate">
                                    {timeFormatted}
                                  </div>
                                </div>

                                {/* Source Badge */}
                                {block.linked_round_id && (
                                  <span className="shrink-0 text-[9px] px-1.5 py-0.2 rounded bg-[#8B5CF6]/30 text-[#8B5CF6] border border-[#8B5CF6]/40 font-semibold uppercase">
                                    Prep
                                  </span>
                                )}
                                {block.linked_task_id && (
                                  <span className="shrink-0 text-[9px] px-1.5 py-0.2 rounded bg-[#10B981]/30 text-[#10B981] border border-[#10B981]/40 font-semibold uppercase">
                                    Task
                                  </span>
                                )}
                              </div>

                              {/* Notes preview if block is tall enough */}
                              {heightPos >= 60 && block.notes && (
                                <p className="text-[10px] text-muted-text/80 line-clamp-1 italic mt-0.5">
                                  {block.notes}
                                </p>
                              )}

                              {/* Bottom Resize Handle */}
                              <div
                                onMouseDown={(e) => {
                                  e.stopPropagation();
                                  setResizingBlockId(block.id);
                                  resizeStartYRef.current = e.clientY;
                                  resizeInitialMinutesRef.current = durationMinutes;

                                  const handleMouseMove = (moveEvent: MouseEvent) => {
                                    const deltaY = moveEvent.clientY - resizeStartYRef.current;
                                    const deltaMinutes = Math.round((deltaY / HOUR_HEIGHT) * 60 / 15) * 15;
                                    const newDuration = Math.max(15, resizeInitialMinutesRef.current + deltaMinutes);
                                    
                                    const newEndTime = new Date(blockStart.getTime() + newDuration * 60 * 1000);
                                    setBlocks(prev => prev.map(b => b.id === block.id ? { ...b, end_time: newEndTime.toISOString() } : b));
                                  };

                                  const handleMouseUp = async (upEvent: MouseEvent) => {
                                    window.removeEventListener('mousemove', handleMouseMove);
                                    window.removeEventListener('mouseup', handleMouseUp);
                                    setResizingBlockId(null);

                                    const deltaY = upEvent.clientY - resizeStartYRef.current;
                                    const deltaMinutes = Math.round((deltaY / HOUR_HEIGHT) * 60 / 15) * 15;
                                    const finalDuration = Math.max(15, resizeInitialMinutesRef.current + deltaMinutes);
                                    const finalEndTime = new Date(blockStart.getTime() + finalDuration * 60 * 1000);

                                    try {
                                      await supabase
                                        .from('schedule_blocks')
                                        .update({ end_time: finalEndTime.toISOString(), updated_at: new Date().toISOString() })
                                        .eq('id', block.id);
                                      showToast('Updated block duration', 'success');
                                    } catch (err) {
                                      console.error('Failed to update duration', err);
                                    }
                                  };

                                  window.addEventListener('mousemove', handleMouseMove);
                                  window.addEventListener('mouseup', handleMouseUp);
                                }}
                                className="h-1.5 w-full cursor-ns-resize hover:bg-white/30 rounded-b transition-colors mt-auto opacity-0 group-hover/block:opacity-100"
                                title="Drag to resize duration"
                              />
                            </div>
                          );
                        })}
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>
          </div>

          {/* MOBILE SINGLE-DAY VIEW (Visible only on screens below md) */}
          <div className="flex md:hidden flex-1 flex-col min-w-0 h-full overflow-hidden bg-background">
            {/* Scrollable Hourly Single-Day Calendar Grid */}
            <div 
              ref={mobileScrollContainerRef}
              className="flex-1 overflow-y-auto overflow-x-hidden relative select-none scroll-smooth"
            >
              <div className="flex min-h-[1536px] w-full relative">
                {/* Time Gutter Column */}
                <div className="w-12 sm:w-14 shrink-0 border-r border-hairline flex flex-col bg-background/50 sticky left-0 z-10 select-none">
                  {HOURS.map(hour => (
                    <div 
                      key={hour} 
                      style={{ height: `${HOUR_HEIGHT}px` }}
                      className="border-b border-hairline/40 text-right pr-1.5 pt-1 text-[10px] sm:text-[11px] font-mono text-muted-text/70"
                    >
                      {hour === 0 ? '12 AM' : hour < 12 ? `${hour} AM` : hour === 12 ? '12 PM' : `${hour - 12} PM`}
                    </div>
                  ))}
                </div>

                {/* Single Full-Width Day Column */}
                <div className="flex-1 relative flex flex-col min-w-0 bg-background">
                  {/* Current Time Red Indicator Line on Mobile */}
                  {isDateToday(selectedMobileDate) && (
                    <div 
                      style={{ top: `${nowLineTop}px` }}
                      className="absolute left-1 right-0 z-[5] pointer-events-none -translate-y-1/2 flex items-center"
                    >
                      <div className="absolute left-0 w-2.5 h-2.5 rounded-full bg-red-500 shadow-[0_0_8px_rgba(239,68,68,0.9)] z-10"></div>
                      <div className="absolute left-[5px] right-0 h-[2px] bg-red-500 shadow-[0_0_8px_rgba(239,68,68,0.9)]"></div>
                    </div>
                  )}

                  {/* Hourly Clickable Cells */}
                  {HOURS.map(hour => (
                    <div
                      key={hour}
                      style={{ height: `${HOUR_HEIGHT}px` }}
                      onClick={() => handleSlotClick(selectedMobileDate, hour)}
                      className="border-b border-white/5 hover:bg-white/5 active:bg-primary-accent/10 cursor-pointer transition-colors relative"
                    >
                      {/* Dotted half-hour indicator */}
                      <div className="absolute top-1/2 left-0 right-0 border-b border-dashed border-hairline/20 pointer-events-none"></div>
                    </div>
                  ))}

                  {/* Rendered Time Blocks for Selected Day */}
                  {(() => {
                    const mobileDayKey = `${selectedMobileDate.getFullYear()}-${String(selectedMobileDate.getMonth() + 1).padStart(2, '0')}-${String(selectedMobileDate.getDate()).padStart(2, '0')}`;
                    const dayBlocks = blocksByDay.get(mobileDayKey) || [];

                    return dayBlocks.map(block => {
                      const blockStart = new Date(block.start_time);
                      const blockEnd = new Date(block.end_time);
                      const startMinutes = blockStart.getHours() * 60 + blockStart.getMinutes();
                      const durationMinutes = Math.max(15, (blockEnd.getTime() - blockStart.getTime()) / (1000 * 60));

                      const topPos = (startMinutes / 60) * HOUR_HEIGHT;
                      const heightPos = (durationMinutes / 60) * HOUR_HEIGHT;

                      const palette = COLOR_PALETTES.find(p => p.value === block.color) || COLOR_PALETTES[0];
                      const timeFormatted = `${blockStart.toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit' })} – ${blockEnd.toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit' })}`;

                      return (
                        <div
                          key={block.id}
                          onClick={(e) => handleBlockClick(e, block)}
                          style={{
                            top: `${topPos}px`,
                            height: `${Math.max(28, heightPos - 2)}px`,
                            borderLeftColor: block.color || '#FF5C38',
                          }}
                          className={`absolute left-1.5 right-1.5 rounded-xl border-l-4 border-t border-r border-b border-white/10 ${palette.bg} backdrop-blur-sm p-2 shadow-md hover:shadow-lg transition-all cursor-pointer z-10 overflow-hidden flex flex-col justify-between`}
                        >
                          <div className="flex items-start justify-between gap-1.5 overflow-hidden">
                            <div className="min-w-0 flex-1">
                              <h4 className="font-bold text-primary-text text-xs leading-snug truncate">
                                {block.title}
                              </h4>
                              {heightPos >= 44 && (
                                <p className="text-[10px] font-mono text-muted-text mt-0.5">
                                  {timeFormatted}
                                </p>
                              )}
                              {heightPos >= 60 && block.notes && (
                                <p className="text-[10.5px] text-muted-text/90 line-clamp-1 italic mt-0.5">
                                  {block.notes}
                                </p>
                              )}
                            </div>

                            {/* Badges */}
                            <div className="shrink-0 flex items-center gap-1">
                              {block.linked_round_id && (
                                <span className="text-[8.5px] px-1.5 py-0.2 rounded font-bold uppercase bg-[#8B5CF6]/30 text-[#8B5CF6] border border-[#8B5CF6]/40">
                                  Prep
                                </span>
                              )}
                              {block.linked_task_id && (
                                <span className="text-[8.5px] px-1.5 py-0.2 rounded font-bold uppercase bg-[#10B981]/30 text-[#10B981] border border-[#10B981]/40">
                                  Task
                                </span>
                              )}
                            </div>
                          </div>
                        </div>
                      );
                    });
                  })()}
                </div>
              </div>
            </div>
          </div>

          {/* DESKTOP UNSCHEDULED SIDEBAR PANEL (Visible only on md screens and up) */}
          {isSidebarOpen && (
            <aside className="hidden md:flex w-80 md:w-88 border-l border-white/10 glass-panel-modal flex-col h-full shrink-0 z-20 shadow-2xl animate-in slide-in-from-right duration-200">
              <div className="p-4 border-b border-hairline flex items-center justify-between">
                <div>
                  <h2 className="text-sm font-bold text-primary-text flex items-center gap-2">
                    <span>Unscheduled Items</span>
                    <span className="text-[11px] px-2 py-0.5 rounded-full bg-white/10 border border-white/10 font-mono text-primary-text">
                      {filteredUnscheduled.length}
                    </span>
                  </h2>
                  <p className="text-xs text-muted-text mt-0.5">Drag onto calendar or click + to place</p>
                </div>
                <button
                  onClick={() => setIsSidebarOpen(false)}
                  className="p-1.5 rounded-lg hover:bg-background text-muted-text hover:text-primary-text transition-colors"
                >
                  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>

              {/* Filter Tabs */}
              <div className="p-2 border-b border-hairline flex gap-1 bg-background/50">
                {(['all', 'prep', 'task'] as const).map(tab => (
                  <button
                    key={tab}
                    onClick={() => setSidebarFilter(tab)}
                    className={`flex-1 py-1.5 text-xs font-semibold rounded-lg capitalize transition-all cursor-pointer ${
                      sidebarFilter === tab
                        ? 'glass-panel text-primary-text border-primary-accent/50 shadow-sm'
                        : 'text-muted-text hover:text-primary-text'
                    }`}
                  >
                    {tab === 'all' ? 'All' : tab === 'prep' ? 'Prep Deadlines' : 'Organize Tasks'}
                  </button>
                ))}
              </div>

              {/* List of Items */}
              <div className="flex-1 overflow-y-auto p-3 space-y-2.5">
                {filteredUnscheduled.length === 0 ? (
                  <div className="p-8 text-center text-muted-text">
                    <svg className="w-8 h-8 mx-auto mb-2 opacity-40" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
                    </svg>
                    <p className="text-xs">No pending items found</p>
                  </div>
                ) : (
                  filteredUnscheduled.map(item => (
                    <div
                      key={item.id}
                      draggable={!item.isScheduled}
                      onDragStart={(e) => handleDragStartUnscheduled(e, item)}
                      className={`p-3 rounded-xl border transition-all ${
                        item.isScheduled
                          ? 'bg-background/40 border-hairline/60 opacity-50 cursor-default'
                          : 'glass-panel-subtle hover:border-white/10 cursor-grab active:cursor-grabbing group/item'
                      }`}
                    >
                      <div className="flex items-start justify-between gap-2">
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-1.5 mb-1">
                            <span
                              className={`text-[9px] px-1.5 py-0.5 rounded font-bold uppercase ${
                                item.type === 'round'
                                  ? 'bg-[#8B5CF6]/20 text-[#8B5CF6] border border-[#8B5CF6]/30'
                                  : 'bg-[#10B981]/20 text-[#10B981] border border-[#10B981]/30'
                              }`}
                            >
                              {item.type === 'round' ? 'Prep' : 'Task'}
                            </span>
                            {item.dueDate && (
                              <span className="text-[10px] text-muted-text font-mono">
                                📅 {new Date(item.dueDate).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })}
                              </span>
                            )}
                          </div>
                          <h4 className="text-xs font-semibold text-primary-text leading-snug line-clamp-2">
                            {item.title}
                          </h4>
                          {item.subtitle && (
                            <p className="text-[11px] text-muted-text/80 line-clamp-1 mt-0.5">
                              {item.subtitle}
                            </p>
                          )}
                        </div>

                        {/* Action buttons */}
                        <div className="shrink-0 flex items-center gap-1">
                          {item.isScheduled ? (
                            <span className="text-[10px] px-2 py-0.5 rounded-full bg-green-500/10 text-green-400 border border-green-500/20 font-medium">
                              Scheduled
                            </span>
                          ) : (
                            <button
                              onClick={() => handleQuickPlaceItem(item)}
                              className="p-1.5 rounded-lg bg-background hover:bg-primary-accent hover:text-white border border-hairline text-muted-text transition-all cursor-pointer"
                              title="1-Click schedule"
                            >
                              <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M12 4v16m8-8H4" />
                              </svg>
                            </button>
                          )}
                        </div>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </aside>
          )}

          {/* MOBILE UNSCHEDULED BOTTOM SHEET OVERLAY (Visible only on screens below md) */}
          {isMobileSheetOpen && (
            <div className="fixed inset-0 z-50 md:hidden bg-background/80 backdrop-blur-sm flex flex-col justify-end animate-in fade-in duration-200">
              <div 
                className="absolute inset-0"
                onClick={() => setIsMobileSheetOpen(false)}
              />
              <div className="relative w-full max-h-[82vh] glass-panel-modal border-t border-white/10 rounded-t-[32px] shadow-[0_-8px_40px_rgba(0,0,0,0.4)] flex flex-col z-10 animate-in slide-in-from-bottom duration-250">
                {/* Handle Bar */}
                <div className="w-12 h-1 bg-hairline rounded-full mx-auto my-2.5 shrink-0" />

                {/* Header */}
                <div className="px-4 py-2 border-b border-hairline flex items-center justify-between">
                  <div>
                    <h2 className="text-sm font-bold text-primary-text flex items-center gap-2">
                      <span>Unscheduled Items</span>
                      <span className="text-[11px] px-2 py-0.5 rounded-full bg-background border border-hairline font-mono text-muted-text">
                        {filteredUnscheduled.length}
                      </span>
                    </h2>
                    <p className="text-[11px] text-muted-text mt-0.5">Tap an item to place it on the calendar</p>
                  </div>
                  <button
                    onClick={() => setIsMobileSheetOpen(false)}
                    className="p-2 rounded-xl bg-background/80 hover:bg-background text-muted-text hover:text-primary-text transition-colors"
                    title="Close"
                  >
                    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                    </svg>
                  </button>
                </div>

                {/* Filter Tabs */}
                <div className="p-2 border-b border-hairline flex gap-1 bg-background/50">
                  {(['all', 'prep', 'task'] as const).map(tab => (
                    <button
                      key={tab}
                      onClick={() => setSidebarFilter(tab)}
                      className={`flex-1 py-1.5 text-xs font-semibold rounded-lg capitalize transition-all cursor-pointer ${
                        sidebarFilter === tab
                          ? 'glass-panel text-primary-text border-primary-accent/50 shadow-sm'
                          : 'text-muted-text hover:text-primary-text'
                      }`}
                    >
                      {tab === 'all' ? 'All' : tab === 'prep' ? 'Prep Deadlines' : 'Organize Tasks'}
                    </button>
                  ))}
                </div>

                {/* Items List */}
                <div className="flex-1 overflow-y-auto p-4 space-y-2.5 pb-8">
                  {filteredUnscheduled.length === 0 ? (
                    <div className="p-8 text-center text-muted-text">
                      <p className="text-xs">No pending items found</p>
                    </div>
                  ) : (
                    filteredUnscheduled.map(item => (
                      <div
                        key={item.id}
                        onClick={() => {
                          if (!item.isScheduled) {
                            setPendingPlacementItem(item);
                            setIsMobileSheetOpen(false);
                            showToast(`Selected "${item.title}" — tap a slot to place`, 'success');
                          }
                        }}
                        className={`p-3.5 rounded-2xl border transition-all ${
                          item.isScheduled
                            ? 'bg-background/40 border-hairline/60 opacity-50 cursor-default'
                            : 'glass-panel-subtle hover:border-white/10 active:border-primary-accent/60 shadow-sm cursor-pointer'
                        }`}
                      >
                        <div className="flex items-start justify-between gap-2">
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-1.5 mb-1">
                              <span
                                className={`text-[9px] px-1.5 py-0.5 rounded font-bold uppercase ${
                                  item.type === 'round'
                                    ? 'bg-[#8B5CF6]/20 text-[#8B5CF6] border border-[#8B5CF6]/30'
                                    : 'bg-[#10B981]/20 text-[#10B981] border border-[#10B981]/30'
                                }`}
                              >
                                {item.type === 'round' ? 'Prep' : 'Task'}
                              </span>
                              {item.dueDate && (
                                <span className="text-[10px] text-muted-text font-mono">
                                  📅 {new Date(item.dueDate).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })}
                                </span>
                              )}
                            </div>
                            <h4 className="text-xs font-semibold text-primary-text leading-snug">
                              {item.title}
                            </h4>
                            {item.subtitle && (
                              <p className="text-[11px] text-muted-text/80 line-clamp-1 mt-0.5">
                                {item.subtitle}
                              </p>
                            )}
                          </div>

                          <div className="shrink-0 flex items-center gap-1.5">
                            {item.isScheduled ? (
                              <span className="text-[10px] px-2 py-0.5 rounded-full bg-green-500/10 text-green-400 border border-green-500/20 font-medium">
                                Scheduled
                              </span>
                            ) : (
                              <div className="flex items-center gap-1">
                                <button
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    setPendingPlacementItem(item);
                                    setIsMobileSheetOpen(false);
                                    showToast(`Selected "${item.title}" — tap a slot to place`, 'success');
                                  }}
                                  className="px-2.5 py-1 rounded-lg bg-primary-accent/15 text-primary-accent border border-primary-accent/30 text-[11px] font-semibold hover:bg-primary-accent hover:text-white transition-colors"
                                >
                                  Place
                                </button>
                                <button
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    handleQuickPlaceItem(item);
                                  }}
                                  className="p-1.5 rounded-lg bg-background hover:bg-primary-accent hover:text-white border border-hairline text-muted-text transition-all"
                                  title="1-Click Auto Place"
                                >
                                  <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M12 4v16m8-8H4" />
                                  </svg>
                                </button>
                              </div>
                            )}
                          </div>
                        </div>
                      </div>
                    ))
                  )}
                </div>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Block Edit / Create Modal */}
      {isModalOpen && editingBlock && (
        <div className="fixed inset-0 z-50 flex flex-col md:flex-row md:items-center justify-end md:justify-center bg-black/60 backdrop-blur-sm md:p-4 animate-in fade-in duration-150">
          {/* Mobile backdrop tap to close */}
          <div className="absolute inset-0 md:hidden" onClick={() => { setIsModalOpen(false); setEditingBlock(null); }} />
          
          <div className="relative glass-panel-modal border border-white/10 rounded-t-[32px] md:rounded-[24px] w-full md:max-w-md p-6 pb-[max(env(safe-area-inset-bottom,24px),24px)] md:pb-6 shadow-[0_-8px_40px_rgba(0,0,0,0.4)] md:shadow-[0_8px_40px_rgba(0,0,0,0.4)] space-y-5 md:space-y-4 mt-auto md:mt-0 animate-in slide-in-from-bottom md:slide-in-from-bottom-0 md:zoom-in-95 duration-200 z-10">
            <div className="flex items-center justify-between border-b border-hairline pb-3">
              <h3 className="text-xl md:text-lg font-serif font-bold text-primary-text">
                {isNewBlock ? 'Create Time Block' : 'Edit Time Block'}
              </h3>
              <button
                onClick={() => { setIsModalOpen(false); setEditingBlock(null); }}
                className="p-2 md:p-1 rounded-full md:rounded-lg text-muted-text hover:text-primary-text hover:bg-background bg-background/50 md:bg-transparent"
              >
                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>

            <div className="space-y-5 md:space-y-3.5 text-sm md:text-xs">
              {/* Title */}
              <div>
                <label className="block text-muted-text font-medium mb-1.5 md:mb-1">Title</label>
                <input
                  type="text"
                  value={editingBlock.title || ''}
                  onChange={(e) => setEditingBlock(prev => ({ ...prev!, title: e.target.value }))}
                  placeholder="e.g. Deep Work, LeetCode Practice, Meeting..."
                  className="w-full px-4 py-3 md:px-3.5 md:py-2.5 bg-background border border-hairline rounded-xl text-primary-text placeholder:text-muted-text/40 focus:outline-none focus:border-primary-accent"
                  autoFocus
                />
              </div>

              {/* Date & Time fields */}
              <div className="space-y-5 md:space-y-3.5">
                {/* Date */}
                <div>
                  <label className="block text-muted-text font-medium mb-1.5 md:mb-1">Date</label>
                  <input
                    type="date"
                    value={editingBlock.start_time ? new Date(new Date(editingBlock.start_time).getTime() - new Date().getTimezoneOffset() * 60000).toISOString().slice(0, 10) : ''}
                    onChange={(e) => {
                      const newDate = e.target.value;
                      if (!newDate) return;
                      const localStart = editingBlock.start_time ? new Date(new Date(editingBlock.start_time).getTime() - new Date().getTimezoneOffset() * 60000).toISOString().slice(11, 16) : '09:00';
                      const localEnd = editingBlock.end_time ? new Date(new Date(editingBlock.end_time).getTime() - new Date().getTimezoneOffset() * 60000).toISOString().slice(11, 16) : '10:00';
                      setEditingBlock(prev => ({ 
                        ...prev!, 
                        start_time: new Date(`${newDate}T${localStart}`).toISOString(),
                        end_time: new Date(`${newDate}T${localEnd}`).toISOString()
                      }));
                    }}
                    className="w-full px-4 py-3 md:px-3.5 md:py-2.5 bg-background border border-hairline rounded-xl text-primary-text focus:outline-none focus:border-primary-accent block appearance-none"
                  />
                </div>
                
                {/* Start & End Time */}
                <div className="grid grid-cols-2 gap-4 md:gap-3">
                  <div>
                    <label className="block text-muted-text font-medium mb-1.5 md:mb-1">Start Time</label>
                    <input
                      type="time"
                      value={editingBlock.start_time ? new Date(new Date(editingBlock.start_time).getTime() - new Date().getTimezoneOffset() * 60000).toISOString().slice(11, 16) : ''}
                      onChange={(e) => {
                        const newTime = e.target.value;
                        if (!newTime) return;
                        const localDate = editingBlock.start_time ? new Date(new Date(editingBlock.start_time).getTime() - new Date().getTimezoneOffset() * 60000).toISOString().slice(0, 10) : new Date().toISOString().slice(0, 10);
                        setEditingBlock(prev => ({ ...prev!, start_time: new Date(`${localDate}T${newTime}`).toISOString() }));
                      }}
                      className="w-full px-4 py-3 md:px-3.5 md:py-2.5 bg-background border border-hairline rounded-xl text-primary-text focus:outline-none focus:border-primary-accent font-mono text-[14px] md:text-[13px] appearance-none"
                    />
                  </div>
                  <div>
                    <label className="block text-muted-text font-medium mb-1.5 md:mb-1">End Time</label>
                    <input
                      type="time"
                      value={editingBlock.end_time ? new Date(new Date(editingBlock.end_time).getTime() - new Date().getTimezoneOffset() * 60000).toISOString().slice(11, 16) : ''}
                      onChange={(e) => {
                        const newTime = e.target.value;
                        if (!newTime) return;
                        const localDate = editingBlock.end_time ? new Date(new Date(editingBlock.end_time).getTime() - new Date().getTimezoneOffset() * 60000).toISOString().slice(0, 10) : new Date().toISOString().slice(0, 10);
                        setEditingBlock(prev => ({ ...prev!, end_time: new Date(`${localDate}T${newTime}`).toISOString() }));
                      }}
                      className="w-full px-4 py-3 md:px-3.5 md:py-2.5 bg-background border border-hairline rounded-xl text-primary-text focus:outline-none focus:border-primary-accent font-mono text-[14px] md:text-[13px] appearance-none"
                    />
                  </div>
                </div>
              </div>

              {/* Category Color Picker */}
              <div>
                <label className="block text-muted-text font-medium mb-2.5 md:mb-1.5">Category Color</label>
                <div className="flex items-center gap-3 md:gap-2">
                  {COLOR_PALETTES.map(p => (
                    <button
                      key={p.value}
                      type="button"
                      onClick={() => setEditingBlock(prev => ({ ...prev!, color: p.value }))}
                      style={{ backgroundColor: p.value }}
                      className={`w-10 h-10 md:w-7 md:h-7 rounded-full transition-transform cursor-pointer ${
                        editingBlock.color === p.value ? 'scale-110 md:scale-125 ring-2 ring-white shadow-md' : 'hover:scale-105 md:hover:scale-110 opacity-70'
                      }`}
                      title={p.label}
                    />
                  ))}
                </div>
              </div>

              {/* Notes */}
              <div>
                <label className="block text-muted-text font-medium mb-1.5 md:mb-1">Notes (Optional)</label>
                <textarea
                  rows={3}
                  value={editingBlock.notes || ''}
                  onChange={(e) => setEditingBlock(prev => ({ ...prev!, notes: e.target.value }))}
                  placeholder="Add details, links, or objectives..."
                  className="w-full px-4 py-3 md:px-3.5 md:py-2 bg-background border border-hairline rounded-xl text-primary-text placeholder:text-muted-text/40 focus:outline-none focus:border-primary-accent resize-none"
                />
              </div>
            </div>

            {/* Modal Actions */}
            <div className="flex flex-col md:flex-row md:items-center justify-between pt-5 md:pt-3 border-t border-hairline gap-3 md:gap-0">
              {!isNewBlock ? (
                <button
                  type="button"
                  onClick={handleDeleteBlock}
                  className="w-full md:w-auto px-4 py-3 md:px-3.5 md:py-2 text-sm md:text-xs font-semibold text-red-400 hover:bg-red-400/10 rounded-xl transition-colors cursor-pointer text-center"
                >
                  Delete Block
                </button>
              ) : <div className="hidden md:block" />}

              <div className="flex flex-col-reverse md:flex-row items-stretch md:items-center gap-3 md:gap-2">
                <button
                  type="button"
                  onClick={() => { setIsModalOpen(false); setEditingBlock(null); }}
                  className="w-full md:w-auto px-4 py-3 md:px-4 md:py-2 text-sm md:text-xs font-semibold text-muted-text hover:text-primary-text hover:bg-background rounded-xl transition-colors text-center"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={handleSaveBlock}
                  className="w-full md:w-auto px-4 py-3 md:px-5 md:py-2 text-sm md:text-xs font-semibold bg-primary-accent text-white rounded-xl hover:brightness-110 shadow-[0_4px_14px_0_rgba(255,92,56,0.39)] transition-all cursor-pointer text-center"
                >
                  Save Block
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
