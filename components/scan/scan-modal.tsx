'use client';

import { useState, useRef, useCallback, useEffect } from 'react';
import Link from 'next/link';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useToast } from '@/hooks/use-toast';
import { ScanLine, Package, Box, Hash, ExternalLink, Loader2, Keyboard, Camera } from 'lucide-react';
import { CameraScanTab } from '@/components/scan/camera-scan-tab';

type ScanLookupProduct = {
  match: 'product';
  product: {
    id: string;
    sku: string;
    barcode: string | null;
    name: string;
    unit: string;
    trackBatches: boolean;
    trackSerials: boolean;
  };
  stock: Array<{
    warehouseId: string;
    warehouseName: string;
    quantity: number;
    batchId: string | null;
    batchNumber: string | null;
  }>;
};

type ScanLookupBatch = {
  match: 'batch';
  product: ScanLookupProduct['product'];
  batch: {
    id: string;
    batchNumber: string;
    barcode: string | null;
    expiryDate: string | null;
  };
  stock: Array<{
    warehouseId: string;
    warehouseName: string;
    quantity: number;
  }>;
};

type ScanLookupSerial = {
  match: 'serial';
  product: {
    id: string;
    sku: string;
    barcode: string | null;
    name: string;
    unit: string;
    trackSerials: boolean;
  };
  serial: {
    id: string;
    serialNumber: string;
    status: string;
    warehouseId: string | null;
    warehouseName: string | null;
  };
};

type ScanResult = ScanLookupProduct | ScanLookupBatch | ScanLookupSerial;

interface ScanModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function ScanModal({ open, onOpenChange }: ScanModalProps) {
  const [code, setCode] = useState('');
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<ScanResult | null>(null);
  const [noMatch, setNoMatch] = useState(false);
  const [activeTab, setActiveTab] = useState<'enter' | 'camera'>('enter');
  const inputRef = useRef<HTMLInputElement>(null);
  const { toast } = useToast();

  const submitLockRef = useRef(false);

  const doLookup = useCallback(
    async (overrideCode?: string) => {
      const trimmed = (overrideCode ?? code).trim();
      if (!trimmed) return;
      if (submitLockRef.current) return;
      submitLockRef.current = true;
      setLoading(true);
      setResult(null);
      setNoMatch(false);
      try {
        const res = await fetch(`/api/scan/lookup?code=${encodeURIComponent(trimmed)}`);
        const data = await res.json().catch(() => ({}));
        if (!res.ok) {
          toast({
            title: 'Lookup failed',
            description: data.error ?? res.statusText,
            variant: 'destructive',
          });
          return;
        }
        if (data.match === null) {
          setNoMatch(true);
          setCode('');
          setTimeout(() => inputRef.current?.focus(), 0);
          return;
        }
        setResult(data as ScanResult);
        setCode('');
        setTimeout(() => inputRef.current?.focus(), 0);
      } finally {
      setLoading(false);
      submitLockRef.current = false;
    }
  },
    [code, toast]
  );

  const handleSubmit = useCallback(
    (e: React.FormEvent) => {
      e.preventDefault();
      doLookup();
    },
    [doLookup]
  );

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent<HTMLInputElement>) => {
      if (e.key === 'Enter') {
        e.preventDefault();
        doLookup();
      }
    },
    [doLookup]
  );

  useEffect(() => {
    if (open) {
      setCode('');
      setResult(null);
      setNoMatch(false);
      setActiveTab('enter');
      const t = setTimeout(() => inputRef.current?.focus(), 100);
      return () => clearTimeout(t);
    }
  }, [open]);

  const handleClearResult = useCallback(() => {
    setResult(null);
    setNoMatch(false);
    inputRef.current?.focus();
  }, []);

  const onSwitchToManual = useCallback(() => setActiveTab('enter'), []);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        className="sm:max-w-md"
        onPointerDownOutside={(e) => e.preventDefault()}
        onEscapeKeyDown={() => onOpenChange(false)}
      >
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <ScanLine className="h-5 w-5" />
            Scan / Enter code
          </DialogTitle>
          <DialogDescription>
            Enter a code manually, use a USB scanner, or scan with the camera.
          </DialogDescription>
        </DialogHeader>

        <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as 'enter' | 'camera')} className="w-full">
          <TabsList className="grid w-full grid-cols-2">
            <TabsTrigger value="enter" className="flex items-center gap-2">
              <Keyboard className="h-4 w-4" />
              Enter code
            </TabsTrigger>
            <TabsTrigger value="camera" className="flex items-center gap-2">
              <Camera className="h-4 w-4" />
              Camera scan
            </TabsTrigger>
          </TabsList>

          <TabsContent value="enter" className="mt-3 space-y-4">
            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <Label htmlFor="scan-code">Code</Label>
                <Input
                  ref={inputRef}
                  id="scan-code"
                  type="text"
                  autoComplete="off"
                  autoFocus
                  placeholder="Scan or type code..."
                  value={code}
                  onChange={(e) => setCode(e.target.value)}
                  onKeyDown={handleKeyDown}
                  disabled={loading}
                  className="mt-1 font-mono text-base"
                />
              </div>
              <Button type="submit" disabled={loading || !code.trim()} className="w-full">
                {loading ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Looking up...
                  </>
                ) : (
                  'Look up'
                )}
              </Button>
            </form>
          </TabsContent>

          <TabsContent value="camera" className="mt-3">
            <CameraScanTab
              onLookupSuccess={doLookup}
              scanningPaused={result != null || loading}
              onSwitchToManual={onSwitchToManual}
            />
          </TabsContent>
        </Tabs>

        {noMatch && (
          <div className="rounded-lg border border-amber-500/50 bg-amber-500/5 px-3 py-2 text-sm text-amber-800 dark:text-amber-200 mt-3">
            No match found for that code. Try another.
          </div>
        )}

        {result && (
          <div className="mt-3">
            <ResultPanel result={result} onClear={handleClearResult} />
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}

function ResultPanel({
  result,
  onClear,
}: {
  result: ScanResult;
  onClear: () => void;
}) {
  const productId = result.product.id;
  const productLink = `/dashboard/products/${productId}`;
  const stockLink = `/dashboard/stock?productId=${productId}`;

  if (result.match === 'product') {
    const { product, stock } = result;
    return (
      <div className="space-y-3 rounded-lg border bg-muted/30 p-3">
        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0">
            <p className="font-medium truncate">{product.name}</p>
            <p className="text-sm text-muted-foreground font-mono">
              {product.sku}
              {product.barcode ? ` · ${product.barcode}` : ''}
            </p>
          </div>
          <Package className="h-5 w-5 shrink-0 text-muted-foreground" />
        </div>
        {stock.length > 0 && (
          <div className="text-xs text-muted-foreground space-y-1">
            <p className="font-medium text-foreground">Stock</p>
            <ul className="space-y-0.5">
              {stock.slice(0, 5).map((s) => (
                <li key={s.warehouseId}>
                  {s.warehouseName}: {s.quantity} {s.batchNumber ? `(${s.batchNumber})` : ''}
                </li>
              ))}
              {stock.length > 5 && <li>+{stock.length - 5} more</li>}
            </ul>
          </div>
        )}
        <div className="flex flex-wrap gap-2 pt-1">
          <Button variant="outline" size="sm" asChild>
            <Link href={productLink}>
              <ExternalLink className="mr-1 h-3 w-3" />
              View product
            </Link>
          </Button>
          <Button variant="outline" size="sm" asChild>
            <Link href={stockLink}>View stock</Link>
          </Button>
          <Button variant="ghost" size="sm" onClick={onClear}>
            Scan another
          </Button>
        </div>
      </div>
    );
  }

  if (result.match === 'batch') {
    const { product, batch, stock } = result;
    return (
      <div className="space-y-3 rounded-lg border bg-muted/30 p-3">
        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0">
            <p className="font-medium truncate">{product.name}</p>
            <p className="text-sm text-muted-foreground font-mono">
              Batch: {batch.batchNumber}
              {batch.expiryDate ? ` · Exp: ${batch.expiryDate.slice(0, 10)}` : ''}
            </p>
          </div>
          <Box className="h-5 w-5 shrink-0 text-muted-foreground" />
        </div>
        {stock.length > 0 && (
          <div className="text-xs text-muted-foreground">
            <p className="font-medium text-foreground">Stock</p>
            <ul className="space-y-0.5">
              {stock.map((s) => (
                <li key={s.warehouseId}>
                  {s.warehouseName}: {s.quantity}
                </li>
              ))}
            </ul>
          </div>
        )}
        <div className="flex flex-wrap gap-2 pt-1">
          <Button variant="outline" size="sm" asChild>
            <Link href={productLink}>
              <ExternalLink className="mr-1 h-3 w-3" />
              View product
            </Link>
          </Button>
          <Button variant="outline" size="sm" asChild>
            <Link href={stockLink}>View stock</Link>
          </Button>
          <Button variant="ghost" size="sm" onClick={onClear}>
            Scan another
          </Button>
        </div>
      </div>
    );
  }

  if (result.match === 'serial') {
    const { product, serial } = result;
    return (
      <div className="space-y-3 rounded-lg border bg-muted/30 p-3">
        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0">
            <p className="font-medium truncate">{product.name}</p>
            <p className="text-sm text-muted-foreground font-mono">
              Serial: {serial.serialNumber} · {serial.status}
            </p>
            {serial.warehouseName && (
              <p className="text-xs text-muted-foreground">At: {serial.warehouseName}</p>
            )}
          </div>
          <Hash className="h-5 w-5 shrink-0 text-muted-foreground" />
        </div>
        <div className="flex flex-wrap gap-2 pt-1">
          <Button variant="outline" size="sm" asChild>
            <Link href={productLink}>
              <ExternalLink className="mr-1 h-3 w-3" />
              View product
            </Link>
          </Button>
          <Button variant="outline" size="sm" asChild>
            <Link href={stockLink}>View stock</Link>
          </Button>
          <Button variant="ghost" size="sm" onClick={onClear}>
            Scan another
          </Button>
        </div>
      </div>
    );
  }

  return null;
}
