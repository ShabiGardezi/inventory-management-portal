'use client';

import { useToast } from '@/hooks/use-toast';
import { Toaster } from '@/components/ui/toast';

export function ToasterProvider() {
  const { toasts, dismiss } = useToast();
  return <Toaster toasts={toasts} onDismiss={dismiss} />;
}
