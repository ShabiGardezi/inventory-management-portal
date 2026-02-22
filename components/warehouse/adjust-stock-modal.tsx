'use client';

import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';

interface AdjustStockModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  warehouseId: string;
  warehouseName: string;
  onSuccess?: () => void;
}

export function AdjustStockModal({
  open,
  onOpenChange,
  warehouseName,
}: AdjustStockModalProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Adjust stock — {warehouseName}</DialogTitle>
        </DialogHeader>
        <p className="text-sm text-muted-foreground">Adjust stock form (implement as needed).</p>
      </DialogContent>
    </Dialog>
  );
}
