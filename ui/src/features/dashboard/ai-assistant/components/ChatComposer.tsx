import { useCallback, useEffect, useId, useLayoutEffect, useMemo, useRef, useState } from 'react';

import { FileText, ImagePlus, Paperclip, Send, Square, X } from 'lucide-react';
import { toast } from 'sonner';

import { ChatComposerContextHub } from '@/features/dashboard/ai-assistant/components/ChatComposerContextHub';
import { ChatComposerSearchAllProvider } from '@/features/dashboard/ai-assistant/components/ChatComposerSearchAllContext';
import { ChatComposerVoiceButton } from '@/features/dashboard/ai-assistant/components/ChatComposerVoiceButton';
import { ChatContextCommandPalette } from '@/features/dashboard/ai-assistant/components/ChatContextCommandPalette';
import { ChatContextPillSuggestions } from '@/features/dashboard/ai-assistant/components/ChatContextPillSuggestions';
import {
  ComposerSuggestionMenu,
  type ComposerSuggestion,
} from '@/features/dashboard/ai-assistant/components/ComposerSuggestionMenu';
import {
  MentionCandidatesLoader,
  type MentionCandidate,
} from '@/features/dashboard/ai-assistant/components/MentionCandidatesLoader';
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
import {
  composerSuggestionOptionId,
  detectComposerTrigger,
  filterSlashCommands,
  removeTriggerToken,
  type SlashCommand,
} from '@/features/dashboard/ai-assistant/lib/composerTriggers';
import { ATTACHED_CONTEXT_ICONS } from '@/features/dashboard/ai-assistant/lib/contextPickerIcons';

import { Button } from '@/components/ui/button';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { CHAT_MESSAGE_MAX_CHARS } from '@/lib/chat/messageLimits';
import { cn } from '@/lib/utils';

const COMPOSER_MIN_HEIGHT_PX = 40;

function syncComposerHeight(textarea: HTMLTextAreaElement | null, maxRows: number) {
  if (!textarea) return;
  textarea.style.height = 'auto';
  const computedMax = Number.parseFloat(window.getComputedStyle(textarea).maxHeight);
  const fallbackMax = maxRows * 20 + 16;
  const cap = Number.isFinite(computedMax) && computedMax > 0 ? computedMax : fallbackMax;
  const next = Math.min(Math.max(textarea.scrollHeight, COMPOSER_MIN_HEIGHT_PX), cap);
  textarea.style.height = `${next}px`;
  textarea.style.overflowY = textarea.scrollHeight > next + 1 ? 'auto' : 'hidden';
}

type Props = {
  onSend: (input: ChatSendInput) => void;
  /** Draft text — owned by the assistant session so it survives mode switches. */
  value: string;
  onValueChange: (value: string) => void;
  /** Pinned context — owned by the assistant session. */
  attachedContext: AttachedContextItem[];
  onAttachedContextChange: (items: AttachedContextItem[]) => void;
  disabled?: boolean;
  sending?: boolean;
  onCancel?: () => void;
  overlayContainer?: HTMLElement | null;
  /** Mid-conversation suggestion pick from a pinned pill. Defaults to sending with current context. */
  onPickSuggestion?: (prompt: string, attachedContext: AttachedContextItem[]) => void;
  /** Up arrow in an empty composer. Return true when an edit started. */
  onEditLast?: () => boolean;
  /** Autosize cap in lines (sheet 10, full page 8). */
  maxRows?: number;
  autoFocus?: boolean;
  placeholder?: string;
  className?: string;
  /** `/` commands offered in this surface (omit to disable slash commands). */
  slashCommands?: SlashCommand[];
  onSlashCommand?: (command: SlashCommand) => void;
};

export function ChatComposer({
  onSend,
  value,
  onValueChange,
  attachedContext,
  onAttachedContextChange,
  disabled,
  sending = false,
  onCancel,
  overlayContainer,
  onPickSuggestion,
  onEditLast,
  maxRows = 10,
  autoFocus = false,
  placeholder = 'Ask about bookings, finance, or maintenance…',
  className,
  slashCommands,
  onSlashCommand,
}: Props) {
  const setValue = onValueChange;
  const attachedContextRef = useRef(attachedContext);
  attachedContextRef.current = attachedContext;
  const setAttachedContext = useCallback(
    (update: (prev: AttachedContextItem[]) => AttachedContextItem[]) =>
      onAttachedContextChange(update(attachedContextRef.current)),
    [onAttachedContextChange]
  );
  const [attachments, setAttachments] = useState<ChatAttachmentPayload[]>([]);
  const [attachOpen, setAttachOpen] = useState(false);
  const [paletteOpen, setPaletteOpen] = useState(false);
  const [paletteMounted, setPaletteMounted] = useState(false);
  const [pillSuggestionType, setPillSuggestionType] = useState<AttachedContextItem | null>(null);
  const reactId = useId();
  const menuId = `${reactId}-suggestions`;
  const [caret, setCaret] = useState(0);
  const [activeIndex, setActiveIndex] = useState(0);
  /** Esc hides the menu for this trigger until the host types something new. */
  const [dismissedTrigger, setDismissedTrigger] = useState<string | null>(null);
  const [mentionCandidates, setMentionCandidates] = useState<MentionCandidate[]>([]);
  const [mentionLoading, setMentionLoading] = useState(false);
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
    const sync = () => syncComposerHeight(textareaRef.current, maxRows);
    sync();
    window.addEventListener('resize', sync);
    return () => window.removeEventListener('resize', sync);
  }, [value, maxRows]);

  useEffect(() => {
    if (autoFocus) textareaRef.current?.focus({ preventScroll: true });
  }, [autoFocus]);

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

  const trigger = disabled ? null : detectComposerTrigger(value, caret);
  const triggerKey = trigger ? `${trigger.kind}:${trigger.start}:${trigger.query}` : null;
  const slashEnabled = Boolean(slashCommands?.length && onSlashCommand);
  const slashMatches =
    trigger?.kind === 'slash' && slashEnabled
      ? filterSlashCommands(trigger.query, slashCommands)
      : [];
  const menuOpen =
    trigger != null &&
    triggerKey !== dismissedTrigger &&
    (trigger.kind === 'mention' || slashEnabled);
  const menuItems: ComposerSuggestion[] = !menuOpen
    ? []
    : trigger?.kind === 'slash'
      ? slashMatches.map((command) => ({
          key: command.id,
          label: command.label,
          hint: command.hint,
        }))
      : mentionCandidates.map(({ item, subtitle }) => {
          const Icon = ATTACHED_CONTEXT_ICONS[item.type];
          return {
            key: `${item.type}:${item.id}`,
            label: item.label,
            hint: subtitle,
            icon: <Icon className="size-4" aria-hidden />,
          };
        });
  const safeActiveIndex = Math.min(activeIndex, Math.max(0, menuItems.length - 1));

  useEffect(() => {
    setActiveIndex(0);
  }, [triggerKey]);

  const onMentionCandidates = useCallback((next: MentionCandidate[], loading: boolean) => {
    setMentionCandidates(next);
    setMentionLoading(loading);
  }, []);

  const placeCaret = (position: number) => {
    setCaret(position);
    requestAnimationFrame(() => {
      const node = textareaRef.current;
      if (!node) return;
      node.focus();
      node.setSelectionRange(position, position);
    });
  };

  const pickSuggestion = (index: number) => {
    if (!trigger) return;
    if (trigger.kind === 'slash') {
      const command = slashMatches[index];
      if (!command || !onSlashCommand) return;
      const next = removeTriggerToken(value, trigger);
      setValue(next.value);
      placeCaret(next.caret);
      onSlashCommand(command);
      return;
    }
    const candidate = mentionCandidates[index];
    if (!candidate) return;
    const next = removeTriggerToken(value, trigger);
    setValue(next.value);
    placeCaret(next.caret);
    addContext(candidate.item);
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
      <div className={cn('border-border/60 shrink-0 border-t p-3', className)}>
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
            'border-border bg-background focus-within:ring-ring relative flex flex-col rounded-xl border p-1.5 focus-within:ring-2',
            listening &&
              'border-destructive/40 ring-destructive/30 focus-within:ring-destructive/30 ring-2'
          )}
        >
          {menuOpen ? (
            <ComposerSuggestionMenu
              id={menuId}
              label={trigger?.kind === 'slash' ? 'Commands' : 'Mention'}
              items={menuItems}
              activeIndex={safeActiveIndex}
              onPick={pickSuggestion}
              onHover={setActiveIndex}
              loading={trigger?.kind === 'mention' && mentionLoading}
              emptyText={trigger?.kind === 'slash' ? 'No commands' : 'No matches'}
            />
          ) : null}
          {trigger?.kind === 'mention' && menuOpen ? (
            <MentionCandidatesLoader query={trigger.query} onChange={onMentionCandidates} />
          ) : null}
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
              setCaret(e.target.selectionStart ?? e.target.value.length);
              setDismissedTrigger(null);
            }}
            onSelect={(e) => setCaret(e.currentTarget.selectionStart ?? 0)}
            onKeyDown={(e) => {
              if (e.nativeEvent.isComposing || e.keyCode === 229) return;
              if (menuOpen) {
                if (e.key === 'Escape') {
                  e.preventDefault();
                  e.stopPropagation();
                  setDismissedTrigger(triggerKey);
                  return;
                }
                if (menuItems.length > 0) {
                  if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
                    e.preventDefault();
                    const delta = e.key === 'ArrowDown' ? 1 : -1;
                    setActiveIndex((safeActiveIndex + delta + menuItems.length) % menuItems.length);
                    return;
                  }
                  if ((e.key === 'Enter' && !e.shiftKey) || e.key === 'Tab') {
                    e.preventDefault();
                    pickSuggestion(safeActiveIndex);
                    return;
                  }
                }
              }
              if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault();
                submit();
                return;
              }
              if (e.key === 'Escape' && sending && onCancel) {
                e.preventDefault();
                e.stopPropagation();
                onCancel();
                return;
              }
              if (
                e.key === 'ArrowUp' &&
                !value &&
                !e.shiftKey &&
                !e.altKey &&
                !e.metaKey &&
                !e.ctrlKey &&
                onEditLast?.()
              ) {
                e.preventDefault();
              }
            }}
            data-assistant-composer="true"
            aria-autocomplete="list"
            aria-controls={menuOpen ? menuId : undefined}
            aria-activedescendant={
              menuOpen && menuItems.length > 0
                ? composerSuggestionOptionId(menuId, safeActiveIndex)
                : undefined
            }
            placeholder={listening ? 'Listening…' : placeholder}
            aria-label={listening ? 'Message, voice input active' : 'Message'}
            rows={1}
            disabled={disabled}
            className="text-foreground placeholder:text-muted-foreground min-h-10 w-full resize-none overflow-hidden bg-transparent px-2.5 pb-1 pt-1.5 text-left text-sm leading-5 [overflow-wrap:anywhere] focus-visible:outline-none disabled:opacity-50"
            style={{ maxHeight: `min(calc(${maxRows}lh + 1rem), 40dvh)` }}
          />

          <div className="flex min-w-0 items-center gap-0.5 overflow-x-auto [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
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
