import { useEffect, useId, useLayoutEffect, useMemo, useRef, useState } from 'react';

import { FileText, ImagePlus, Paperclip, Send, Square, X } from 'lucide-react';
import { toast } from 'sonner';

import { ChatComposerContextHub } from '@/features/dashboard/ai-assistant/components/ChatComposerContextHub';
import { ChatComposerSearchAllProvider } from '@/features/dashboard/ai-assistant/components/ChatComposerSearchAllContext';
import { ChatComposerVoiceButton } from '@/features/dashboard/ai-assistant/components/ChatComposerVoiceButton';
import { ChatContextCommandPalette } from '@/features/dashboard/ai-assistant/components/ChatContextCommandPalette';
import { ChatContextPillSuggestions } from '@/features/dashboard/ai-assistant/components/ChatContextPillSuggestions';
import { useSpeechToText } from '@/features/dashboard/ai-assistant/hooks/useSpeechToText';
import {
  ATTACHED_CONTEXT_MAX,
  attachedContextKey,
  removeAttachedContext,
  upsertAttachedContext,
  type AttachedContextItem,
} from '@/features/dashboard/ai-assistant/lib/attachedContext';
import {
  ASSISTANT_FILE_ACCEPT,
  ASSISTANT_IMAGE_ACCEPT,
  fileToBase64Payload,
  isAssistantImageMime,
  validateAssistantFiles,
  type ChatAttachmentPayload,
  type ChatSendInput,
} from '@/features/dashboard/ai-assistant/lib/chatAttachments';
import { ATTACHED_CONTEXT_ICONS } from '@/features/dashboard/ai-assistant/lib/contextPickerIcons';

import { Button } from '@/components/ui/button';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { CHAT_MESSAGE_MAX_CHARS } from '@/lib/chat/messageLimits';
import { cn } from '@/lib/utils';

const COMPOSER_MAX_ROWS = 10;
const COMPOSER_MIN_HEIGHT_PX = 40;

function syncComposerHeight(textarea: HTMLTextAreaElement | null) {
  if (!textarea) return;
  textarea.style.height = 'auto';
  const computedMax = Number.parseFloat(window.getComputedStyle(textarea).maxHeight);
  const fallbackMax = COMPOSER_MAX_ROWS * 20 + 16;
  const cap = Number.isFinite(computedMax) && computedMax > 0 ? computedMax : fallbackMax;
  const next = Math.min(Math.max(textarea.scrollHeight, COMPOSER_MIN_HEIGHT_PX), cap);
  textarea.style.height = `${next}px`;
  textarea.style.overflowY = textarea.scrollHeight > next + 1 ? 'auto' : 'hidden';
}

type Props = {
  onSend: (input: ChatSendInput) => void;
  disabled?: boolean;
  sending?: boolean;
  onCancel?: () => void;
  pageBookingId?: string | null;
  overlayContainer?: HTMLElement | null;
  onAttachedContextChange?: (items: AttachedContextItem[]) => void;
  /** Mid-conversation suggestion pick from a pinned pill. Defaults to sending with current context. */
  onPickSuggestion?: (prompt: string, attachedContext: AttachedContextItem[]) => void;
};

export function ChatComposer({
  onSend,
  disabled,
  sending = false,
  onCancel,
  pageBookingId: _pageBookingId,
  overlayContainer,
  onAttachedContextChange,
  onPickSuggestion,
}: Props) {
  const [value, setValue] = useState('');
  const [attachedContext, setAttachedContext] = useState<AttachedContextItem[]>([]);
  const [attachments, setAttachments] = useState<ChatAttachmentPayload[]>([]);
  const [attachOpen, setAttachOpen] = useState(false);
  const [paletteOpen, setPaletteOpen] = useState(false);
  const [paletteMounted, setPaletteMounted] = useState(false);
  const [pillSuggestionType, setPillSuggestionType] = useState<AttachedContextItem | null>(null);
  const reactId = useId();
  const imageInputId = `${reactId}-image`;
  const fileInputId = `${reactId}-file`;
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const selectedKeys = useMemo(
    () => new Set(attachedContext.map((item) => attachedContextKey(item))),
    [attachedContext]
  );

  const {
    supported: speechSupported,
    listening,
    toggle: toggleSpeech,
    stop: stopSpeech,
  } = useSpeechToText({
    value,
    onChange: setValue,
    disabled,
  });

  const openPalette = () => {
    setPaletteMounted(true);
    setPaletteOpen(true);
  };

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.defaultPrevented) return;
      if (event.key.toLowerCase() !== 'k') return;
      if (!(event.metaKey || event.ctrlKey) || event.altKey || event.shiftKey) return;
      event.preventDefault();
      setPaletteMounted(true);
      setPaletteOpen((open) => !open);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  useLayoutEffect(() => {
    const sync = () => syncComposerHeight(textareaRef.current);
    sync();
    window.addEventListener('resize', sync);
    return () => window.removeEventListener('resize', sync);
  }, [value]);

  useEffect(() => {
    onAttachedContextChange?.(attachedContext);
  }, [attachedContext, onAttachedContextChange]);

  const addFiles = async (fileList: FileList | null) => {
    if (!fileList?.length) return;
    const files = Array.from(fileList);
    const error = validateAssistantFiles(files, attachments.length);
    if (error) {
      toast.error(error);
      return;
    }
    try {
      const next = await Promise.all(files.map(fileToBase64Payload));
      setAttachments((prev) => [...prev, ...next]);
    } catch {
      toast.error('Could not read file');
    }
  };

  const addContext = (item: AttachedContextItem) => {
    setAttachedContext((prev) => {
      if (
        prev.length >= ATTACHED_CONTEXT_MAX &&
        !prev.some((p) => p.type === item.type && p.id === item.id)
      ) {
        toast.error(`Up to ${ATTACHED_CONTEXT_MAX} items`);
        return prev;
      }
      return upsertAttachedContext(prev, item);
    });
  };

  const submit = () => {
    const trimmed = value.trim();
    if (disabled) return;
    if (!trimmed && attachments.length === 0) return;
    stopSpeech();
    onSend({
      text: trimmed,
      attachedContext,
      attachments,
    });
    setValue('');
    setAttachments([]);
  };

  // Tapping a ranked prompt inside a pinned pill's popover sends it as a chat message,
  // carrying the current pinned context (including that pill).
  const pickPillSuggestion = (prompt: string) => {
    if (disabled || sending) return;
    stopSpeech();
    setPillSuggestionType(null);
    if (onPickSuggestion) {
      onPickSuggestion(prompt, attachedContext);
    } else {
      onSend({ text: prompt, attachedContext, attachments: [] });
    }
  };

  return (
    <ChatComposerSearchAllProvider onSearchAll={openPalette}>
      <div className="border-border/60 shrink-0 border-t p-3">
        {(attachedContext.length > 0 || attachments.length > 0) && (
          <div className="mb-2 flex flex-wrap gap-1.5">
            {attachedContext.map((item) => {
              const Icon = ATTACHED_CONTEXT_ICONS[item.type];
              const pillKey = `${item.type}:${item.id}`;
              const isPillSuggestionOpen =
                pillSuggestionType != null &&
                pillSuggestionType.type === item.type &&
                pillSuggestionType.id === item.id;
              return (
                <span
                  key={pillKey}
                  className="bg-muted text-foreground inline-flex max-w-full items-center gap-0 rounded-full py-0.5 pl-0.5 pr-1 text-xs"
                >
                  <Popover
                    open={isPillSuggestionOpen}
                    onOpenChange={(next) => setPillSuggestionType(next ? item : null)}
                  >
                    <PopoverTrigger asChild>
                      <button
                        type="button"
                        disabled={disabled || sending}
                        aria-label={`Suggested prompts for ${item.label}`}
                        aria-expanded={isPillSuggestionOpen}
                        className={cn(
                          'native-press focus-visible:ring-ring inline-flex min-h-[32px] min-w-0 cursor-pointer items-center gap-1 rounded-full px-1.5 py-1 focus-visible:outline-none focus-visible:ring-2',
                          'transition-colors duration-150',
                          '[@media(hover:hover)]:hover:text-primary',
                          isPillSuggestionOpen && 'text-primary',
                          'disabled:pointer-events-none disabled:opacity-50'
                        )}
                      >
                        <Icon className="h-3 w-3 shrink-0" aria-hidden />
                        <span className="max-w-[12rem] truncate">{item.label}</span>
                      </button>
                    </PopoverTrigger>
                    <PopoverContent
                      align="start"
                      side="top"
                      container={overlayContainer}
                      className="w-[min(calc(100vw-2rem),22rem)] p-0"
                      onCloseAutoFocus={(event) => event.preventDefault()}
                    >
                      <ChatContextPillSuggestions
                        moduleType={item.type}
                        onPick={pickPillSuggestion}
                        disabled={disabled || sending}
                      />
                    </PopoverContent>
                  </Popover>
                  <button
                    type="button"
                    className="focus-visible:ring-ring ml-0.5 inline-flex min-h-[24px] min-w-[24px] items-center justify-center rounded-full focus-visible:outline-none focus-visible:ring-2"
                    aria-label={`Remove ${item.label}`}
                    onClick={() => setAttachedContext((prev) => removeAttachedContext(prev, item))}
                  >
                    <X className="h-3 w-3" aria-hidden />
                  </button>
                </span>
              );
            })}
            {attachments.map((file, index) => (
              <span
                key={`${file.name}-${index}`}
                className="bg-muted text-foreground inline-flex max-w-full items-center gap-1 rounded-full px-2.5 py-1 text-xs"
              >
                {isAssistantImageMime(file.mimeType) ? (
                  <ImagePlus className="h-3 w-3 shrink-0" aria-hidden />
                ) : (
                  <FileText className="h-3 w-3 shrink-0" aria-hidden />
                )}
                <span className="truncate">{file.name}</span>
                <button
                  type="button"
                  className="focus-visible:ring-ring inline-flex min-h-[24px] min-w-[24px] items-center justify-center rounded-full focus-visible:outline-none focus-visible:ring-2"
                  aria-label={`Remove ${file.name}`}
                  onClick={() => setAttachments((prev) => prev.filter((_, i) => i !== index))}
                >
                  <X className="h-3 w-3" aria-hidden />
                </button>
              </span>
            ))}
          </div>
        )}

        <div
          className={cn(
            'border-border bg-background focus-within:ring-ring flex flex-col rounded-xl border p-1.5 focus-within:ring-2',
            listening &&
              'border-destructive/40 ring-destructive/30 focus-within:ring-destructive/30 ring-2'
          )}
        >
          <input
            id={imageInputId}
            type="file"
            accept={ASSISTANT_IMAGE_ACCEPT}
            className="sr-only"
            multiple
            onChange={(e) => {
              void addFiles(e.target.files);
              e.target.value = '';
              setAttachOpen(false);
            }}
          />
          <input
            id={fileInputId}
            type="file"
            accept={ASSISTANT_FILE_ACCEPT}
            className="sr-only"
            multiple
            onChange={(e) => {
              void addFiles(e.target.files);
              e.target.value = '';
              setAttachOpen(false);
            }}
          />

          <textarea
            ref={textareaRef}
            value={value}
            maxLength={CHAT_MESSAGE_MAX_CHARS}
            onChange={(e) => {
              if (listening) stopSpeech();
              setValue(e.target.value);
            }}
            onKeyDown={(e) => {
              if (e.nativeEvent.isComposing || e.keyCode === 229) return;
              if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault();
                submit();
              }
            }}
            placeholder={listening ? 'Listening…' : 'Ask about bookings, finance, or maintenance…'}
            aria-label={listening ? 'Message, voice input active' : 'Message'}
            rows={1}
            disabled={disabled}
            className="text-foreground placeholder:text-muted-foreground min-h-10 w-full resize-none overflow-hidden bg-transparent px-2.5 pb-1 pt-1.5 text-left text-sm leading-5 [overflow-wrap:anywhere] focus-visible:outline-none disabled:opacity-50"
            style={{ maxHeight: `min(calc(${COMPOSER_MAX_ROWS}lh + 1rem), 40dvh)` }}
          />

          <div className="flex items-center gap-0.5">
            <ChatComposerContextHub
              selectedKeys={selectedKeys}
              onSelect={addContext}
              disabled={disabled}
              overlayContainer={overlayContainer}
            />

            <Popover open={attachOpen} onOpenChange={setAttachOpen}>
              <PopoverTrigger asChild>
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  disabled={disabled}
                  aria-label="Attach"
                  aria-expanded={attachOpen}
                  className="min-h-[44px] min-w-[44px] shrink-0"
                >
                  <Paperclip className="h-4 w-4" aria-hidden />
                </Button>
              </PopoverTrigger>
              <PopoverContent
                align="start"
                side="top"
                container={overlayContainer}
                className="w-44 p-1"
                onCloseAutoFocus={(event) => event.preventDefault()}
              >
                <label
                  htmlFor={imageInputId}
                  className={cn(
                    'native-press hover:bg-muted/60 flex min-h-[44px] cursor-pointer items-center gap-2.5 rounded-lg px-2.5 py-2 text-sm',
                    disabled && 'pointer-events-none opacity-50'
                  )}
                >
                  <ImagePlus className="size-4 shrink-0" aria-hidden />
                  Photo
                </label>
                <label
                  htmlFor={fileInputId}
                  className={cn(
                    'native-press hover:bg-muted/60 flex min-h-[44px] cursor-pointer items-center gap-2.5 rounded-lg px-2.5 py-2 text-sm',
                    disabled && 'pointer-events-none opacity-50'
                  )}
                >
                  <FileText className="size-4 shrink-0" aria-hidden />
                  File
                </label>
              </PopoverContent>
            </Popover>

            {speechSupported ? (
              <ChatComposerVoiceButton
                listening={listening}
                disabled={disabled}
                onClick={() => {
                  toggleSpeech();
                  textareaRef.current?.focus();
                }}
              />
            ) : null}

            <Button
              size="icon"
              onClick={sending ? onCancel : submit}
              disabled={
                sending ? !onCancel : disabled || (!value.trim() && attachments.length === 0)
              }
              aria-label={sending ? 'Stop response' : 'Send message'}
              className="ml-auto min-h-[44px] min-w-[44px] shrink-0"
            >
              {sending ? (
                <Square className="h-4 w-4 fill-current" aria-hidden />
              ) : (
                <Send className="h-4 w-4" aria-hidden />
              )}
            </Button>
          </div>
        </div>
        {paletteMounted ? (
          <ChatContextCommandPalette
            open={paletteOpen}
            onOpenChange={setPaletteOpen}
            onSelect={addContext}
            selectedKeys={selectedKeys}
          />
        ) : null}
      </div>
    </ChatComposerSearchAllProvider>
  );
}
