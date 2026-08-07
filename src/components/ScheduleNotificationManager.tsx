'use client';

import { useEffect, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { supabase } from '@/lib/supabase';
import { useToast } from '@/components/ToastProvider';

export default function ScheduleNotificationManager() {
  const { showToast } = useToast();
  const router = useRouter();
  const isCheckingRef = useRef(false);

  useEffect(() => {
    // Check every 30 seconds
    const checkUpcomingBlocks = async () => {
      if (isCheckingRef.current) return;
      
      try {
        const { data: { session } } = await supabase.auth.getSession();
        if (!session?.user?.id) return;

        isCheckingRef.current = true;

        const now = new Date();
        // 10 minutes window: from now up to 10.5 minutes in the future
        const tenMinutesFromNow = new Date(now.getTime() + 10.5 * 60 * 1000);

        const { data: blocks, error } = await supabase
          .from('schedule_blocks')
          .select('*')
          .eq('user_id', session.user.id)
          .is('notified_at', null)
          .gte('start_time', now.toISOString())
          .lte('start_time', tenMinutesFromNow.toISOString())
          .order('start_time', { ascending: true });

        if (error) {
          console.error('Error checking schedule reminders:', error);
          return;
        }

        if (!blocks || blocks.length === 0) return;

        for (const block of blocks) {
          const startTime = new Date(block.start_time);
          const diffMinutes = Math.max(1, Math.round((startTime.getTime() - now.getTime()) / (60 * 1000)));
          const formattedTime = startTime.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' });

          // 1. Show In-App Toast
          showToast(`⏰ Upcoming: "${block.title}" starts in ${diffMinutes}m (${formattedTime})`, 'success');

          // 2. Native Desktop / Electron Notification
          if (typeof window !== 'undefined' && 'Notification' in window && Notification.permission === 'granted') {
            try {
              const notification = new Notification(`⏰ Upcoming: ${block.title}`, {
                body: `Starts in ${diffMinutes} min at ${formattedTime}${block.notes ? ` • ${block.notes}` : ''}`,
                icon: '/icon.svg',
                tag: `schedule-${block.id}`,
              });

              notification.onclick = () => {
                window.focus();
                router.push('/app/schedule');
                notification.close();
              };
            } catch (notifErr) {
              console.warn('Native notification failed:', notifErr);
            }
          }

          // 3. Mark as notified in database to prevent duplicates
          await supabase
            .from('schedule_blocks')
            .update({ notified_at: new Date().toISOString() })
            .eq('id', block.id);
        }
      } catch (err) {
        console.error('Failed to run schedule notification check:', err);
      } finally {
        isCheckingRef.current = false;
      }
    };

    // Run initial check on mount, then interval
    checkUpcomingBlocks();
    const intervalId = setInterval(checkUpcomingBlocks, 30000);

    return () => clearInterval(intervalId);
  }, [showToast, router]);

  return null;
}
