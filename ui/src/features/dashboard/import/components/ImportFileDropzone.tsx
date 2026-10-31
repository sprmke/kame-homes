import * as React from 'react';

import { FileSpreadsheet, Loader2, Upload } from 'lucide-react';

import { ImportAlert } from '@/features/dashboard/import/components/ImportModalChrome';
import { useImportParseFile } from '@/features/dashboard/import/hooks/useImportParseFile';
import {
  IMPORT_ACCEPT,
  IMPORT_LIMITS_HINT,
  validateImportCsvFile,
} from '@/features/dashboard/import/lib/importUploadLimits';
import type { ImportParseResult } from '@/features/dashboard/import/types/importParse';

import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

type Props = {
  id?: string;
  disabled?: boolean;
  onParsed?: (result: ImportParseResult) => void;
  onError?: (message: string) => void;
  className?: string;
};

export function ImportFileDropzone({
  id = 'import-csv-file',
  disabled = false,
  onParsed,
  onError,
  className,
}: Props) {
  const parseFile = useImportParseFile();
  const [dragActive, setDragActive] = React.useState(false);
  const [selectedFile, setSelectedFile] = React.useState<File | null>(null);
  const [lastResult, setLastResult] = React.useState<ImportParseResult | null>(null);
  const [localError, setLocalError] = React.useState<string | null>(null);
  const inputRef = React.useRef<HTMLInputElement>(null);

  const busy = disabled || parseFile.isPending;

  const reportError = React.useCallback(
    (message: string) => {
      setLocalError(message);
      onError?.(message);
    },
    [onError]
  );

  const uploadFile = React.useCallback(
    async (file: File) => {
      setLocalError(null);
      setLastResult(null);

      const validationError = validateImportCsvFile(file);
      if (validationError) {
        reportError(validationError);
        return;
      }

      setSelectedFile(file);
      try {
        const result = await parseFile.mutateAsync(file);
        setLastResult(result);
        onParsed?.(result);
      } catch (error) {
        setSelectedFile(null);
        reportError((error as Error).message);
      }
    },
    [onParsed, parseFile, reportError]
  );

  const handleFile = React.useCallback(
    (file: File | undefined) => {
      if (!file || busy) return;
      void uploadFile(file);
    },
    [busy, uploadFile]
  );

  const onDragEnter = (event: React.DragEvent) => {
    event.preventDefault();
    event.stopPropagation();
    if (!busy) setDragActive(true);
  };

  const onDragLeave = (event: React.DragEvent) => {
    event.preventDefault();
    event.stopPropagation();
    if (event.currentTarget.contains(event.relatedTarget as Node)) return;
    setDragActive(false);
  };

  const onDragOver = (event: React.DragEvent) => {
    event.preventDefault();
    event.stopPropagation();
  };

  const onDrop = (event: React.DragEvent) => {
    event.preventDefault();
    event.stopPropagation();
    setDragActive(false);
    if (busy) return;
    handleFile(event.dataTransfer.files?.[0]);
  };

  const clearSelection = () => {
    setSelectedFile(null);
    setLastResult(null);
    setLocalError(null);
    if (inputRef.current) inputRef.current.value = '';
  };

  return (
    <div className={cn('space-y-3', className)}>
      {/* Before the dropzone so `peer-focus-visible` can ring it for keyboard users. */}
      <input
        ref={inputRef}
        id={id}
        type="file"
        accept={IMPORT_ACCEPT}
        className="peer sr-only"
        disabled={busy}
        onChange={(event) => {
          handleFile(event.target.files?.[0]);
          event.target.value = '';
        }}
      />

      <div
        className={cn(
          'border-border/80 bg-muted/20 peer-focus-visible:ring-ring relative flex min-h-[180px] items-center justify-center overflow-hidden rounded-xl border border-dashed transition-colors peer-focus-visible:ring-2 peer-focus-visible:ring-offset-2',
          !busy && !lastResult && 'hover:border-primary/50 hover:bg-primary/[0.03]',
          dragActive && 'border-primary bg-primary/5',
          localError && 'border-destructive/60',
          busy && 'opacity-70'
        )}
        onDragEnter={onDragEnter}
        onDragLeave={onDragLeave}
        onDragOver={onDragOver}
        onDrop={onDrop}
      >
        {parseFile.isPending ? (
          <div className="text-muted-foreground flex flex-col items-center gap-2 px-4 py-8 text-sm">
            <Loader2 className="size-5 animate-spin" aria-hidden />
            <span>Reading {selectedFile?.name ?? 'your file'}…</span>
          </div>
        ) : lastResult ? (
          <div className="flex w-full flex-col items-center gap-2 px-4 py-8 text-center">
            <FileSpreadsheet className="text-primary size-8" aria-hidden />
            <p className="text-foreground max-w-full truncate text-sm font-medium">
              {selectedFile?.name}
            </p>
            <p className="text-muted-foreground text-xs tabular-nums">
              {lastResult.rowCount.toLocaleString()} rows · {lastResult.headers.length} columns
            </p>
            <Button type="button" variant="outline" size="sm" onClick={clearSelection}>
              Choose another file
            </Button>
          </div>
        ) : (
          <label
            htmlFor={id}
            className={cn(
              'flex min-h-[180px] w-full flex-col items-center justify-center gap-2.5 px-4 py-8 text-center',
              busy ? 'cursor-not-allowed' : 'cursor-pointer'
            )}
          >
            <span className="bg-primary/10 text-primary flex size-11 items-center justify-center rounded-full">
              <Upload className="size-5" aria-hidden />
            </span>
            <span className="text-foreground text-sm font-medium">
              Drop a CSV or Excel file here or browse
            </span>
            <span className="text-muted-foreground text-xs">{IMPORT_LIMITS_HINT}</span>
          </label>
        )}
      </div>

      {localError ? <ImportAlert tone="error">{localError}</ImportAlert> : null}
    </div>
  );
}
