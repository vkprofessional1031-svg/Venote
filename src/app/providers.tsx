'use client';

import { ToastProvider } from '@/components/ToastProvider';
import ScheduleNotificationManager from '@/components/ScheduleNotificationManager';

export function Providers({ children }: { children: React.ReactNode }) {
  return (
    <ToastProvider>
      <ScheduleNotificationManager />
      {children}
    </ToastProvider>
  );
}
