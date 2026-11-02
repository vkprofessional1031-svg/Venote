'use client';

import { ToastProvider } from '@/components/ToastProvider';
import { ThemeProvider } from '@/components/ThemeProvider';
import { CommandPaletteProvider } from '@/components/CommandPaletteProvider';

export function Providers({ children }: { children: React.ReactNode }) {
  return (
    <ThemeProvider>
      <ToastProvider>
        <CommandPaletteProvider>{children}</CommandPaletteProvider>
      </ToastProvider>
    </ThemeProvider>
  );
}
