import * as React from 'react';

import { Braces, Eye, Pencil, RotateCcw, Send } from 'lucide-react';

import { useTelegramTemplateDialogActions } from '@/features/dashboard/bookings/components/telegram-notifications/TelegramTemplateDialogContext';
import { useTelegramTemplateLivePreview } from '@/features/dashboard/bookings/hooks/useTelegramTemplateLivePreview';
import type { TelegramPreviewContext } from '@/features/dashboard/bookings/lib/telegramDraftPreviewApi';
import {
  getTelegramPreviewSamples,
  type TelegramPreviewSampleSet,
} from '@/features/dashboard/bookings/lib/telegramPreviewSamples';
import {
  applyTelegramPlaceholders,
  normalizeTelegramTemplateText,
  renderTelegramPlaceholderHighlights,
} from '@/features/dashboard/bookings/lib/telegramTemplatePreview';

import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Skeleton } from '@/components/ui/skeleton';
import { SegmentedControl } from '@/components/ui/sliding-tabs';
import { cn } from '@/lib/utils';

type EditorTab = 'edit' | 'preview';

const EDITOR_VIEW_OPTIONS = [
  { value: 'edit' as const, label: 'Edit', icon: Pencil },
  { value: 'preview' as const, label: 'Preview', icon: Eye },
];

type Props = {
  id: string;
  label: string;
  value: string;
  onChange: (value: string) => void;
  disabled?: boolean;
  onSendDraft?: () => void;
  onReset?: () => void;
  sendPreviewTitle?: string;
  previewSampleSet?: TelegramPreviewSampleSet;
  previewContext?: TelegramPreviewContext;
  /** When set, only `{{key}}` tokens in this set are highlighted in edit mode. */
  validPlaceholderKeys?: ReadonlySet<string>;
  rows?: number;
  minHeightClassName?: string;
  mono?: boolean;
  className?: string;
  labelClassName?: string;
};

function editTextLayerClass(mono?: boolean) {
  return cn(
    'box-border w-full min-w-0 whitespace-pre-wrap break-words px-4 py-3 text-sm font-medium leading-[1.5] sm:text-[13px]',
    mono && 'font-mono'
  );
}

function syncTextareaHeight(textarea: HTMLTextAreaElement | null) {
  if (!textarea) return;
  textarea.style.height = 'auto';
  textarea.style.height = `${textarea.scrollHeight}px`;
}

export function TelegramTemplateEditor({
  id,
  label,
  value,
  onChange,
  disabled,
  onSendDraft,
  onReset,
  sendPreviewTitle = 'Send test with live data.',
  previewSampleSet,
  previewContext,
  validPlaceholderKeys,
  rows = 3,
  minHeightClassName = 'min-h-[88px]',
  mono,
  className,
  labelClassName,
}: Props) {
  const [tab, setTab] = React.useState<EditorTab>('edit');
  const templateDialog = useTelegramTemplateDialogActions();
  const textareaRef = React.useRef<HTMLTextAreaElement>(null);
  const valueRef = React.useRef(value);
  valueRef.current = value;
  const inputId = `${id}-textarea`;
  const previewId = `${id}-preview`;

  const resolvedValidKeys = React.useMemo(() => {
    if (validPlaceholderKeys && validPlaceholderKeys.size > 0) {
      return validPlaceholderKeys;
    }
    if (previewSampleSet) {
      return new Set(Object.keys(getTelegramPreviewSamples(previewSampleSet)));
    }
    return undefined;
  }, [validPlaceholderKeys, previewSampleSet]);

  const livePreview = useTelegramTemplateLivePreview(value, previewContext, tab === 'preview');

  const contentClassName = cn(
    'w-full min-w-0 text-sm font-medium leading-[1.5] sm:text-[13px]',
    minHeightClassName,
    mono && 'font-mono'
  );

  const samplePreviewText = React.useMemo(() => {
    if (!previewSampleSet || !value.trim()) return value;
    return applyTelegramPlaceholders(value, getTelegramPreviewSamples(previewSampleSet));
  }, [previewSampleSet, value]);

  const useLivePreview =
    tab === 'preview' &&
    !!previewContext &&
    !!value.trim() &&
    livePreview.isSuccess &&
    !!livePreview.data?.renderedText;

  const previewText = useLivePreview ? livePreview.data!.renderedText : samplePreviewText;

  const previewFooter = React.useMemo(() => {
    if (tab !== 'preview' || !value.trim()) return null;
    if (livePreview.isLoading && previewContext) {
      return 'Loading live preview…';
    }
    if (useLivePreview) {
      return 'Live preview';
    }
    if (livePreview.isError && previewContext && previewSampleSet) {
      return `Sample data. Live preview unavailable (${(livePreview.error as Error).message})`;
    }
    if (livePreview.isError && previewContext) {
      return (livePreview.error as Error).message;
    }
    if (previewSampleSet) {
      return 'Sample data';
    }
    return null;
  }, [
    tab,
    value,
    livePreview.isLoading,
    livePreview.isError,
    livePreview.error,
    previewContext,
    previewSampleSet,
    useLivePreview,
  ]);

  const commitNormalizedValue = React.useCallback(() => {
    const normalized = normalizeTelegramTemplateText(value);
    if (normalized !== value) onChange(normalized);
  }, [onChange, value]);

  React.useLayoutEffect(() => {
    if (tab !== 'edit') return;
    syncTextareaHeight(textareaRef.current);
  }, [tab, value, rows]);

  React.useEffect(() => {
    const insertRef = templateDialog?.insertTokenRef;
    if (!insertRef) return;

    insertRef.current = (token: string) => {
      setTab('edit');
      window.requestAnimationFrame(() => {
        const textarea = textareaRef.current;
        if (!textarea) {
          onChange(`${valueRef.current}${token}`);
          return;
        }
        const start = textarea.selectionStart ?? textarea.value.length;
        const end = textarea.selectionEnd ?? start;
        const next = textarea.value.slice(0, start) + token + textarea.value.slice(end);
        onChange(next);
        window.requestAnimationFrame(() => {
          textarea.focus();
          const pos = start + token.length;
          textarea.setSelectionRange(pos, pos);
          syncTextareaHeight(textarea);
        });
      });
    };

    return () => {
      insertRef.current = null;
    };
  }, [templateDialog?.insertTokenRef, onChange]);

  return (
    <div
      className={cn(
        'border-border/80 bg-background/80 grid grid-cols-1 gap-2 rounded-lg border p-2.5 sm:grid-cols-[minmax(0,1fr)_auto] sm:items-start sm:gap-x-3 sm:gap-y-2 sm:p-3',
        className
      )}
    >
      <div className="flex min-w-0 flex-wrap items-center gap-2 sm:col-start-1 sm:row-start-1 sm:self-center">
        <Label
          htmlFor={tab === 'edit' ? inputId : previewId}
          className={cn(
            'text-muted-foreground min-w-0 text-xs font-semibold uppercase tracking-wide sm:text-[11px]',
            labelClassName
          )}
        >
          {label}
        </Label>
        <SegmentedControl
          value={tab}
          onChange={setTab}
          options={EDITOR_VIEW_OPTIONS.map((option) => ({ ...option, disabled }))}
          size="dense"
          aria-label={`${label} view`}
        />
      </div>

      {onSendDraft || templateDialog || onReset ? (
        <div className="flex w-full flex-wrap items-center justify-end gap-2 sm:col-start-2 sm:row-start-1 sm:self-center sm:justify-self-end">
          {templateDialog ? (
            <Button
              type="button"
              variant="outline"
              size="sm"
              disabled={disabled || templateDialog.disabled}
              className="min-h-[44px] gap-1.5 sm:min-h-9"
              onClick={templateDialog.openPlaceholders}
            >
              <Braces className="size-4 shrink-0" aria-hidden />
              Placeholders
            </Button>
          ) : null}
          {onReset ? (
            <Button
              type="button"
              variant="outline"
              size="sm"
              disabled={disabled}
              className="min-h-[44px] gap-1.5 sm:min-h-9"
              onClick={onReset}
            >
              <RotateCcw className="size-4 shrink-0" aria-hidden />
              Reset
            </Button>
          ) : null}
          {onSendDraft ? (
            <Button
              type="button"
              variant="outline"
              size="sm"
              disabled={disabled}
              className="min-h-[44px] w-full min-w-0 sm:h-9 sm:min-h-9 sm:w-auto sm:shrink-0"
              title={sendPreviewTitle}
              onClick={() => onSendDraft()}
            >
              <Send className="size-4 shrink-0" aria-hidden />
              Send preview
            </Button>
          ) : null}
        </div>
      ) : null}

      <div className="col-span-full min-w-0 sm:col-span-2 sm:row-start-2">
        {tab === 'edit' ? (
          <div
            className={cn(
              'border-border/70 bg-card dark:border-border/50 dark:bg-muted/40 resize-y overflow-auto rounded-lg border shadow-[inset_0_1px_2px_hsl(240_6%_10%_/0.04)] dark:shadow-none',
              contentClassName
            )}
          >
            <div className="relative grid min-w-0 [&>*]:col-start-1 [&>*]:row-start-1">
              <div
                aria-hidden
                className={cn('text-foreground pointer-events-none', editTextLayerClass(mono))}
              >
                {value ? (
                  renderTelegramPlaceholderHighlights(
                    value,
                    `${id}-edit-`,
                    resolvedValidKeys,
                    'edit'
                  )
                ) : (
                  <span className="text-transparent">
                    Type your message. Use {'{{placeholder}}'} tokens.
                  </span>
                )}
              </div>
              <textarea
                ref={textareaRef}
                id={inputId}
                disabled={disabled}
                rows={rows}
                spellCheck={false}
                autoComplete="off"
                autoCorrect="off"
                autoCapitalize="off"
                placeholder="Type your message. Use {{placeholder}} tokens."
                value={value}
                onChange={(e) => {
                  onChange(e.target.value);
                  syncTextareaHeight(e.target);
                }}
                onBlur={commitNormalizedValue}
                style={{ WebkitTextFillColor: 'transparent' }}
                className={cn(
                  'caret-foreground selection:bg-primary/20 relative z-[1] block min-h-full w-full resize-none overflow-hidden border-0 bg-transparent text-transparent outline-none selection:text-transparent focus-visible:ring-0 disabled:cursor-not-allowed disabled:opacity-50',
                  editTextLayerClass(mono)
                )}
              />
            </div>
          </div>
        ) : (
          <div className="space-y-1.5">
            <div
              id={previewId}
              role="region"
              aria-label={`${label} preview`}
              aria-busy={livePreview.isLoading && !!previewContext}
              className={cn(
                'border-border/70 bg-card text-foreground dark:border-border/50 dark:bg-muted/40 rounded-lg border px-4 py-3 text-sm font-medium shadow-[inset_0_1px_2px_hsl(240_6%_10%_/0.04)] dark:shadow-none',
                contentClassName,
                'resize-y overflow-auto whitespace-pre-wrap'
              )}
            >
              {!value.trim() ? (
                <span className="text-muted-foreground">Nothing to preview yet.</span>
              ) : livePreview.isLoading && previewContext ? (
                <div className="space-y-2 py-1" aria-hidden>
                  <Skeleton className="h-3.5 w-[92%]" />
                  <Skeleton className="h-3.5 w-[78%]" />
                  <Skeleton className="h-3.5 w-[85%]" />
                  <Skeleton className="h-3.5 w-[60%]" />
                </div>
              ) : (
                renderTelegramPlaceholderHighlights(
                  previewText,
                  `${id}-preview-`,
                  resolvedValidKeys,
                  'preview'
                )
              )}
            </div>
            {previewFooter ? (
              <p
                className={cn(
                  'text-caption text-muted-foreground text-xs',
                  livePreview.isError && previewContext && !previewSampleSet && 'text-destructive'
                )}
              >
                {previewFooter}
              </p>
            ) : null}
          </div>
        )}
      </div>
    </div>
  );
}
