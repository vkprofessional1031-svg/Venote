'use client';

import React, { createContext, useContext, useState, useCallback } from 'react';

export type ToastType = 'success' | 'error';

interface ToastAction {
  label: string;
  onClick: () => void;
}

interface Toast {
  id: string;
  message: string;
  type: ToastType;
  action?: ToastAction;
}

interface ToastContextValue {
  showToast: (message: string, type?: ToastType, action?: ToastAction, duration?: number) => void;
}

const ToastContext = createContext<ToastContextValue | undefined>(undefined);

export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([]);

  const showToast = useCallback((message: string, type: ToastType = 'success', action?: ToastAction, duration?: number) => {
    const id = crypto.randomUUID();
    setToasts(prev => {
      const newToasts = [...prev, { id, message, type, action }];
      if (newToasts.length > 3) {
        return newToasts.slice(newToasts.length - 3);
      }
      return newToasts;
    });

    const timeout = duration || (action ? 8000 : 2500);

    setTimeout(() => {
      setToasts(prev => prev.filter(t => t.id !== id));
    }, timeout);
  }, []);

  return (
    <ToastContext.Provider value={{ showToast }}>
      {children}
      <div className="fixed bottom-6 right-6 z-[60] flex flex-col gap-2 pointer-events-none items-end">
        {toasts.map(toast => (
          <div
            key={toast.id}
            className={`
              pointer-events-auto flex items-center px-4 py-2.5 rounded-full shadow-lg text-sm font-medium gap-3
              toast-enter
              ${toast.type === 'success' ? 'bg-[#1E1A17] text-secondary-accent border border-secondary-accent/20' : 'bg-[#1E1A17] text-primary-accent border border-primary-accent/20'}
            `}
          >
            <span>{toast.message}</span>
            {toast.action && (
              <button
                onClick={() => {
                  toast.action!.onClick();
                  setToasts(prev => prev.filter(t => t.id !== toast.id));
                }}
                className={`text-xs font-bold uppercase tracking-wider px-2 py-1 rounded-md transition-colors ${
                  toast.type === 'success' ? 'hover:bg-secondary-accent/10' : 'hover:bg-primary-accent/10'
                }`}
              >
                {toast.action.label}
              </button>
            )}
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  );
}

export function useToast() {
  const context = useContext(ToastContext);
  if (!context) {
    throw new Error('useToast must be used within a ToastProvider');
  }
  return context;
}
