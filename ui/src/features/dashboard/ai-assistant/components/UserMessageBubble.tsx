import { useEffect, useRef, useState } from 'react';

import { FileText, ImagePlus, Pencil } from 'lucide-react';

import type { ChatThreadMessage } from '@/features/dashboard/ai-assistant/hooks/useAiAssistantChat';
import { isAssistantImageMime } from '@/features/dashboard/ai-assistant/lib/chatAttachments';

import { Button } from '@/components/ui/button';
import { CHAT_MESSAGE_MAX_CHARS } from '@/lib/chat/messageLimits';
import { cn } from '@/lib/utils';

type Props = {
  message: ChatThreadMessage;
  /** Edit & resend is offered on saved text messages without files. */
  canEdit: boolean;
  editing: boolean;
  onStartEdit: () => void;
  onCancelEdit: () => void;
  onSubmitEdit: (text: string) => void;
  surface: 'sheet' | 'full';
};

export function UserMessageBubble({
  message,
  canEdit,
  editing,
  onStartEdit,
  onCancelEdit,
  onSubmitEdit,
  surface,
}: Props) {
  const [draft, setDraft] = useState(message.text ?? '');
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    if (!editing) return;
    setDraft(message.text ?? '');
    const node = textareaRef.current;
    if (node) {
      node.focus();
      node.setSelectionRange(node.value.length, node.value.length);
    }
  }, [editing, message.text]);

  if (editing) {
    const trimmed = draft.trim();
    return (
      <div className="bg-muted w-full max-w-[85%] rounded-2xl p-2">
        <textarea
          ref={textareaRef}
          value={draft}
          maxLength={CHAT_MESSAGE_MAX_CHARS}
          onChange={(event) => setDraft(event.target.value)}
          onKeyDown={(event) => {
            if (event.nativeEvent.isComposing) return;
            if (event.key === 'Escape') {
              event.preventDefault();
              onCancelEdit();
            }
            if (event.key === 'Enter' && !event.shiftKey && trimmed) {
              event.preventDefault();
              onSubmitEdit(trimmed);
            }
          }}
          rows={3}
          aria-label="Edit message"
          className="text-foreground focus-visible:ring-ring w-full resize-none rounded-xl bg-transparent p-2 text-sm focus-visible:outline-none focus-visible:ring-2"
        />
        <div className="flex justify-end gap-2 pt-1">
          <Button
            type="button"
            variant="ghost"
            size="sm"
            className="min-h-[40px]"
            onClick={onCancelEdit}
          >
            Cancel
          </Button>
          <Button
            type="button"
            size="sm"
            className="min-h-[40px]"
            disabled={!trimmed}
            onClick={() => onSubmitEdit(trimmed)}
          >
            Send
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="group flex max-w-[85%] flex-col items-end">
      <div
        className={cn(
          'rounded-2xl rounded-br-md px-3 py-2',
          surface === 'full' ? 'bg-muted text-foreground' : 'bg-primary text-primary-foreground'
        )}
      >
        <div className="space-y-1.5">
          {message.attachedContext && message.attachedContext.length > 0 ? (
            <p
              className={cn(
                'text-xs',
                surface === 'full' ? 'text-muted-foreground' : 'text-primary-foreground/80'
              )}
            >
              {message.attachedContext.map((item) => item.label).join(' · ')}
            </p>
          ) : null}
          {message.attachments && message.attachments.length > 0 ? (
            <ul className="flex flex-wrap gap-1">
              {message.attachments.map((file, index) => (
                <li
                  key={`${file.name}-${index}`}
                  className={cn(
                    'inline-flex max-w-full items-center gap-1 rounded-full px-2 py-0.5 text-xs',
                    surface === 'full' ? 'bg-background/70' : 'bg-primary-foreground/15'
                  )}
                >
                  {isAssistantImageMime(file.mimeType) ? (
                    <ImagePlus className="h-3 w-3 shrink-0" aria-hidden />
                  ) : (
                    <FileText className="h-3 w-3 shrink-0" aria-hidden />
                  )}
                  <span className="truncate">{file.name}</span>
                </li>
              ))}
            </ul>
          ) : null}
          {message.text ? (
            <p className="whitespace-pre-line break-words text-sm">{message.text}</p>
          ) : null}
        </div>
      </div>
      {canEdit ? (
        <Button
          type="button"
          variant="ghost"
          size="icon"
          className="text-muted-foreground hover:text-foreground mt-0.5 size-9 min-h-[36px] min-w-[36px] [@media(hover:hover)]:opacity-0 [@media(hover:hover)]:transition-opacity [@media(hover:hover)]:group-focus-within:opacity-100 [@media(hover:hover)]:group-hover:opacity-100"
          onClick={onStartEdit}
          aria-label="Edit message"
        >
          <Pencil className="size-4" aria-hidden />
        </Button>
      ) : null}
    </div>
  );
}
