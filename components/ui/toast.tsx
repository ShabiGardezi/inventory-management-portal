'use client';

import * as React from 'react';
import { X } from 'lucide-react';
import { cn } from '@/lib/utils';

export interface ToastProps {
  id: string;
  title?: string;
  description?: string;
  variant?: 'default' | 'destructive';
  onDismiss?: () => void;
}

export function Toast({ id, title, description, variant = 'default', onDismiss }: ToastProps) {
  return (
    <div
      className={cn(
        'group pointer-events-auto relative flex w-full items-center justify-between space-x-4 overflow-hidden rounded-md border p-6 pr-8 shadow-lg transition-all',
        variant === 'destructive'
          ? 'border-destructive bg-destructive text-destructive-foreground'
          : 'border bg-background text-foreground'
      )}
    >
      <div className="grid gap-1">
        {title && <div className="text-sm font-semibold">{title}</div>}
        {description && (
          <div
            className={cn(
              'text-sm opacity-90',
              variant === 'destructive' ? '' : 'text-muted-foreground'
            )}
          >
            {description}
          </div>
        )}
      </div>
      {onDismiss && (
        <button
          className="absolute right-2 top-2 rounded-md p-1 text-foreground/50 opacity-0 transition-opacity hover:text-foreground focus:opacity-100 focus:outline-none focus:ring-2 group-hover:opacity-100"
          onClick={onDismiss}
        >
          <X className="h-4 w-4" />
        </button>
      )}
    </div>
  );
}

export function Toaster({ toasts, onDismiss }: { toasts: any[]; onDismiss: (id: string) => void }) {
  if (toasts.length === 0) return null;

  return (
    <div className="fixed top-0 z-[100] flex max-h-screen w-full flex-col-reverse p-4 sm:bottom-0 sm:right-0 sm:top-auto sm:flex-col md:max-w-[420px]">
      {toasts.map((toast) => (
        <Toast
          key={toast.id}
          {...toast}
          onDismiss={() => onDismiss(toast.id)}
        />
      ))}
    </div>
  );
}
