'use client';

import { useState, useCallback, useEffect } from 'react';
import React from 'react';

export interface Toast {
  id: string;
  title?: string;
  description?: string;
  variant?: 'default' | 'destructive';
}

let toastCount = 0;

const toastListeners = new Set<(toasts: Toast[]) => void>();
let globalToasts: Toast[] = [];

function notify() {
  toastListeners.forEach((listener) => listener([...globalToasts]));
}

export function useToast() {
  const [toasts, setToasts] = useState<Toast[]>(globalToasts);

  useEffect(() => {
    const listener = (newToasts: Toast[]) => {
      setToasts(newToasts);
    };
    toastListeners.add(listener);
    return () => {
      toastListeners.delete(listener);
    };
  }, []);

  const toast = useCallback(
    ({ title, description, variant = 'default' }: Omit<Toast, 'id'>) => {
      const id = (toastCount++).toString();
      const newToast: Toast = { id, title, description, variant };

      globalToasts = [...globalToasts, newToast];
      notify();

      setTimeout(() => {
        globalToasts = globalToasts.filter((t) => t.id !== id);
        notify();
      }, 3000);

      return {
        id,
        dismiss: () => {
          globalToasts = globalToasts.filter((t) => t.id !== id);
          notify();
        },
      };
    },
    []
  );

  const dismiss = useCallback((id: string) => {
    globalToasts = globalToasts.filter((t) => t.id !== id);
    notify();
  }, []);

  return { toast, toasts, dismiss };
}
