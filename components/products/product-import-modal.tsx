'use client';

import { useState, useCallback, useEffect } from 'react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { useToast } from '@/hooks/use-toast';
import {
  Upload,
  FileSpreadsheet,
  FileText,
  CheckCircle2,
  XCircle,
  AlertCircle,
  Download,
  ChevronRight,
  HelpCircle,
} from 'lucide-react';

type Step = 'upload' | 'preview' | 'result';

interface ValidateResult {
  detectedColumns: { name: string; status: 'matched' | 'missing' }[];
  previewRows: Record<string, unknown>[];
  totalRows: number;
  validationErrors: { rowIndex: number; errors: string[] }[];
  validCount: number;
}

interface ImportResult {
  total: number;
  created: number;
  updated: number;
  failed: number;
  failedRows: { rowIndex: number; sku: string; errors: string[] }[];
}

interface ProductImportModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess?: () => void;
}

export function ProductImportModal({
  open,
  onOpenChange,
  onSuccess,
}: ProductImportModalProps) {
  const { toast } = useToast();
  const [step, setStep] = useState<Step>('upload');
  const [file, setFile] = useState<File | null>(null);
  const [validateResult, setValidateResult] = useState<ValidateResult | null>(null);
  const [importResult, setImportResult] = useState<ImportResult | null>(null);
  const [loading, setLoading] = useState(false);
  const [importing, setImporting] = useState(false);
  const [mode, setMode] = useState<'create_only' | 'upsert'>('create_only');
  const [allowPartial, setAllowPartial] = useState(false);
  const [defaultWarehouseId, setDefaultWarehouseId] = useState<string>('__none__');
  const [warehouses, setWarehouses] = useState<{ id: string; name: string; code: string | null }[]>([]);
  const [dragOver, setDragOver] = useState(false);
  const [helpOpen, setHelpOpen] = useState(false);

  const reset = useCallback(() => {
    setStep('upload');
    setFile(null);
    setValidateResult(null);
    setImportResult(null);
    setMode('create_only');
    setAllowPartial(false);
    setDefaultWarehouseId('__none__');
  }, []);

  const handleClose = useCallback(
    (open: boolean) => {
      if (!open) reset();
      onOpenChange(open);
    },
    [onOpenChange, reset]
  );

  const fetchWarehouses = useCallback(async () => {
    try {
      const res = await fetch('/api/warehouses?limit=100');
      if (res.ok) {
        const data = await res.json();
        setWarehouses(data.list ?? []);
      }
    } catch {
      // ignore
    }
  }, []);

  useEffect(() => {
    if (open) fetchWarehouses();
  }, [open, fetchWarehouses]);

  const downloadTemplate = useCallback(async (format: 'csv' | 'xlsx') => {
    try {
      const res = await fetch(`/api/products/import/template?format=${format}`);
      if (!res.ok) throw new Error('Failed to download');
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = format === 'csv' ? 'products_import_template.csv' : 'products_import_template.xlsx';
      a.click();
      URL.revokeObjectURL(url);
      toast({ title: 'Download started', description: `Template.${format}` });
    } catch {
      toast({ title: 'Download failed', variant: 'destructive' });
    }
  }, [toast]);

  const onFileSelect = useCallback((f: File | null) => {
    if (!f) {
      setFile(null);
      return;
    }
    const name = f.name.toLowerCase();
    if (!name.endsWith('.csv') && !name.endsWith('.xlsx')) {
      toast({ title: 'Invalid file', description: 'Use .csv or .xlsx', variant: 'destructive' });
      return;
    }
    setFile(f);
    setValidateResult(null);
    setImportResult(null);
  }, [toast]);

  const handleValidate = useCallback(async () => {
    if (!file) return;
    setLoading(true);
    try {
      const form = new FormData();
      form.append('file', file);
      const res = await fetch('/api/products/import/validate', {
        method: 'POST',
        body: form,
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? 'Validation failed');
      setValidateResult(data);
      setStep('preview');
    } catch (e) {
      toast({
        title: 'Validation failed',
        description: e instanceof Error ? e.message : 'Unknown error',
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  }, [file, toast]);

  const handleImport = useCallback(async () => {
    if (!file) return;
    setImporting(true);
    try {
      const form = new FormData();
      form.append('file', file);
      form.append(
        'options',
        JSON.stringify({
          mode,
          allowPartial,
          defaultWarehouseId: defaultWarehouseId === '__none__' ? null : defaultWarehouseId,
        })
      );
      const res = await fetch('/api/products/import', {
        method: 'POST',
        body: form,
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? 'Import failed');
      setImportResult(data);
      setStep('result');
      const { created, updated, failed } = data;
      toast({
        title: 'Import completed',
        description: `Created: ${created}, Updated: ${updated}, Failed: ${failed}`,
      });
      onSuccess?.();
    } catch (e) {
      toast({
        title: 'Import failed',
        description: e instanceof Error ? e.message : 'Unknown error',
        variant: 'destructive',
      });
    } finally {
      setImporting(false);
    }
  }, [file, mode, allowPartial, defaultWarehouseId, onSuccess, toast]);

  const downloadErrorReport = useCallback(() => {
    if (!importResult?.failedRows?.length) return;
    const headers = ['rowIndex', 'sku', 'errors'];
    const rows = importResult.failedRows.map(
      (r) => `${r.rowIndex},${r.sku},"${r.errors.join('; ').replace(/"/g, '""')}"`
    );
    const csv = [headers.join(','), ...rows].join('\n');
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `import_errors_${Date.now()}.csv`;
    a.click();
    URL.revokeObjectURL(url);
    toast({ title: 'Error report downloaded' });
  }, [importResult, toast]);

  const previewHeaders = validateResult?.previewRows?.[0]
    ? Object.keys(validateResult.previewRows[0])
    : [];

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Bulk Import Products</DialogTitle>
          <DialogDescription>
            Import products from CSV or Excel. Download a template, fill it, then upload.
          </DialogDescription>
        </DialogHeader>

        {step === 'upload' && (
          <div className="space-y-6">
            <div className="grid gap-4">
              <Label>Templates</Label>
              <div className="flex gap-2">
                <Button type="button" variant="outline" onClick={() => downloadTemplate('csv')}>
                  <FileText className="mr-2 h-4 w-4" />
                  Download CSV Template
                </Button>
                <Button type="button" variant="outline" onClick={() => downloadTemplate('xlsx')}>
                  <FileSpreadsheet className="mr-2 h-4 w-4" />
                  Download Excel Template
                </Button>
              </div>
            </div>

            <div className="grid gap-2">
              <Label>Upload file</Label>
              <div
                className={`border-2 border-dashed rounded-lg p-8 text-center transition-colors ${
                  dragOver ? 'border-primary bg-primary/5' : 'border-muted-foreground/25'
                }`}
                onDragOver={(e) => {
                  e.preventDefault();
                  setDragOver(true);
                }}
                onDragLeave={() => setDragOver(false)}
                onDrop={(e) => {
                  e.preventDefault();
                  setDragOver(false);
                  const f = e.dataTransfer.files[0];
                  if (f) onFileSelect(f);
                }}
              >
                <input
                  type="file"
                  accept=".csv,.xlsx"
                  className="hidden"
                  id="import-file"
                  onChange={(e) => onFileSelect(e.target.files?.[0] ?? null)}
                />
                <Upload className="mx-auto h-10 w-10 text-muted-foreground mb-2" />
                <p className="text-sm text-muted-foreground">
                  Drag & drop a file here, or{' '}
                  <label htmlFor="import-file" className="text-primary cursor-pointer underline">
                    browse
                  </label>
                </p>
                {file && (
                  <p className="mt-2 text-sm font-medium">{file.name}</p>
                )}
              </div>
            </div>

            <div className="flex justify-end">
              <Button
                disabled={!file || loading}
                onClick={handleValidate}
              >
                {loading ? 'Validating…' : 'Validate & Preview'}
                <ChevronRight className="ml-2 h-4 w-4" />
              </Button>
            </div>
          </div>
        )}

        {step === 'preview' && validateResult && (
          <div className="space-y-6">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Mode</Label>
                <Select value={mode} onValueChange={(v) => setMode(v as 'create_only' | 'upsert')}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="create_only">Create only (skip existing SKU)</SelectItem>
                    <SelectItem value="upsert">Upsert by SKU (update existing)</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>On validation errors</Label>
                <Select
                  value={allowPartial ? 'partial' : 'all'}
                  onValueChange={(v) => setAllowPartial(v === 'partial')}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All-or-nothing (no write if any error)</SelectItem>
                    <SelectItem value="partial">Import valid rows only</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="space-y-2">
              <Label>Default warehouse (opening stock)</Label>
              <Select
                value={defaultWarehouseId}
                onValueChange={setDefaultWarehouseId}
              >
                <SelectTrigger>
                  <SelectValue placeholder="None" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="__none__">None</SelectItem>
                  {warehouses.map((wh) => (
                    <SelectItem key={wh.id} value={wh.id}>
                      {wh.name} {wh.code ? `(${wh.code})` : ''}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label>Column mapping</Label>
              <div className="flex flex-wrap gap-2">
                {validateResult.detectedColumns.map((c) => (
                  <span
                    key={c.name}
                    className={`inline-flex items-center gap-1 rounded px-2 py-1 text-xs ${
                      c.status === 'matched' ? 'bg-green-100 text-green-800' : 'bg-muted text-muted-foreground'
                    }`}
                  >
                    {c.status === 'matched' ? <CheckCircle2 className="h-3 w-3" /> : <AlertCircle className="h-3 w-3" />}
                    {c.name}
                  </span>
                ))}
              </div>
            </div>

            <div className="space-y-2">
              <Label>Preview (first 20 rows)</Label>
              <div className="rounded-md border overflow-auto max-h-48">
                <Table>
                  <TableHeader>
                    <TableRow>
                      {previewHeaders.map((h) => (
                        <TableHead key={h} className="whitespace-nowrap">{h}</TableHead>
                      ))}
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {validateResult.previewRows.slice(0, 20).map((row, i) => (
                      <TableRow key={i}>
                        {previewHeaders.map((h) => (
                          <TableCell key={h} className="max-w-[200px] truncate">
                            {String(row[h] ?? '')}
                          </TableCell>
                        ))}
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            </div>

            {validateResult.validationErrors.length > 0 && (
              <div className="rounded-md border border-amber-200 bg-amber-50 dark:bg-amber-950/30 p-3">
                <p className="text-sm font-medium text-amber-800 dark:text-amber-200">
                  {validateResult.validationErrors.length} row(s) with validation errors
                </p>
                <p className="text-xs text-amber-700 dark:text-amber-300 mt-1">
                  Valid rows: {validateResult.validCount} / {validateResult.totalRows}
                </p>
              </div>
            )}

            <div className="flex justify-between">
              <Button variant="outline" onClick={() => setStep('upload')}>
                Back
              </Button>
              <Button disabled={importing} onClick={handleImport}>
                {importing ? 'Importing…' : 'Import'}
              </Button>
            </div>
          </div>
        )}

        {step === 'result' && importResult && (
          <div className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle>Import summary</CardTitle>
              </CardHeader>
              <CardContent className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <div>
                  <p className="text-sm text-muted-foreground">Total rows</p>
                  <p className="text-2xl font-semibold">{importResult.total}</p>
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Created</p>
                  <p className="text-2xl font-semibold text-green-600">{importResult.created}</p>
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Updated</p>
                  <p className="text-2xl font-semibold text-blue-600">{importResult.updated}</p>
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Failed</p>
                  <p className="text-2xl font-semibold text-destructive">{importResult.failed}</p>
                </div>
              </CardContent>
            </Card>

            {importResult.failedRows.length > 0 && (
              <>
                <div className="flex items-center justify-between">
                  <Label>Failed rows</Label>
                  <Button variant="outline" size="sm" onClick={downloadErrorReport}>
                    <Download className="mr-2 h-4 w-4" />
                    Download Error Report CSV
                  </Button>
                </div>
                <div className="rounded-md border overflow-auto max-h-48">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Row</TableHead>
                        <TableHead>SKU</TableHead>
                        <TableHead>Errors</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {importResult.failedRows.map((r, i) => (
                        <TableRow key={i}>
                          <TableCell>{r.rowIndex}</TableCell>
                          <TableCell className="font-mono">{r.sku}</TableCell>
                          <TableCell className="text-destructive text-sm">{r.errors.join('; ')}</TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              </>
            )}

            <div className="flex justify-end">
              <Button onClick={() => handleClose(false)}>Done</Button>
            </div>
          </div>
        )}

        <div className="border-t pt-4 mt-4">
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={() => setHelpOpen((o) => !o)}
          >
            <HelpCircle className="mr-2 h-4 w-4" />
            Required & optional columns
          </Button>
          {helpOpen && (
            <div className="mt-3 text-sm text-muted-foreground space-y-2">
              <p><strong>Required:</strong> sku, name</p>
              <p><strong>Recommended:</strong> category, unit, costPrice, sellPrice, reorderLevel, barcode, isActive</p>
              <p><strong>Optional:</strong> description, openingStock, warehouseCode</p>
              <p>sku: unique, letters/numbers/hyphen/underscore. isActive: TRUE/FALSE or 1/0. Prices &ge; 0.</p>
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
