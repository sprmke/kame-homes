import * as React from 'react';

import { Check, Folder, FolderOpen } from 'lucide-react';

import type { PropertyTemplateFolderDto } from '@/features/dashboard/bookings/hooks/usePropertyTemplates';
import {
  placementFromEntry,
  placementsEqual,
  templatePlacementTargets,
  type TemplateLibraryEntry,
  type TemplatePlacement,
} from '@/features/dashboard/bookings/lib/templateLibrary';

import { UnsavedChangesDialog } from '@/components/forms/UnsavedChangesDialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  ResponsiveModal,
  ResponsiveModalContent,
  ResponsiveModalDescription,
  ResponsiveModalFooter,
  ResponsiveModalHeader,
  ResponsiveModalTitle,
} from '@/components/ui/responsive-modal';
import { useGuardedClose } from '@/hooks/useGuardedClose';
import { cn } from '@/lib/utils';

/**
 * Single-field name prompt shared by "New folder", "Rename folder" and
 * "Rename template". A typed-but-unsaved name is a draft, so closing runs
 * through the shared unsaved-changes guard.
 */
export function TemplateNamePromptDialog({
  open,
  onOpenChange,
  title,
  description,
  label,
  initialValue,
  confirmLabel,
  busy,
  maxLength,
  onSubmit,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  description?: string;
  label: string;
  initialValue: string;
  confirmLabel: string;
  busy?: boolean;
  maxLength: number;
  onSubmit: (name: string) => Promise<void> | void;
}) {
  const [value, setValue] = React.useState(initialValue);
  const inputId = React.useId();

  React.useEffect(() => {
    if (open) setValue(initialValue);
  }, [open, initialValue]);

  const trimmed = value.trim();
  const dirty = trimmed.length > 0 && trimmed !== initialValue.trim();
  const canSubmit = dirty && !busy;

  const submit = async (): Promise<boolean> => {
    if (!canSubmit) return false;
    try {
      await onSubmit(trimmed);
    } catch {
      return false;
    }
    onOpenChange(false);
    return true;
  };

  const {
    onOpenChange: handleOpenChange,
    requestClose,
    dialogProps,
  } = useGuardedClose({
    open,
    onOpenChange,
    isDirty: dirty,
    onSave: submit,
    onDiscard: () => setValue(initialValue),
  });

  return (
    <>
      <ResponsiveModal open={open} onOpenChange={handleOpenChange}>
        <ResponsiveModalContent className="sm:max-w-[28rem]">
          <ResponsiveModalHeader>
            <ResponsiveModalTitle>{title}</ResponsiveModalTitle>
            {description ? (
              <ResponsiveModalDescription>{description}</ResponsiveModalDescription>
            ) : null}
          </ResponsiveModalHeader>

          <div className="space-y-2 px-4 pb-2 sm:px-0">
            <Label htmlFor={inputId} className="settings-field-label">
              {label}
            </Label>
            <Input
              id={inputId}
              value={value}
              autoFocus
              maxLength={maxLength}
              onChange={(event) => setValue(event.target.value)}
              onKeyDown={(event) => {
                if (event.key === 'Enter') {
                  event.preventDefault();
                  void submit();
                }
              }}
            />
          </div>

          <ResponsiveModalFooter className="gap-1">
            <Button type="button" variant="outline" onClick={requestClose}>
              Cancel
            </Button>
            <Button type="button" disabled={!canSubmit} onClick={() => void submit()}>
              {busy ? 'Saving…' : confirmLabel}
            </Button>
          </ResponsiveModalFooter>
        </ResponsiveModalContent>
      </ResponsiveModal>

      <UnsavedChangesDialog {...dialogProps} />
    </>
  );
}

/** Picks where a host-owned template should sit. */
export function TemplateMoveDialog({
  open,
  onOpenChange,
  templateName,
  entry,
  folders,
  busy,
  onMove,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  templateName: string;
  entry: TemplateLibraryEntry | null;
  folders: PropertyTemplateFolderDto[];
  busy?: boolean;
  onMove: (placement: TemplatePlacement) => Promise<void> | void;
}) {
  const currentPlacement = entry ? placementFromEntry(entry) : null;
  const targets = React.useMemo(
    () => templatePlacementTargets(folders, { includeUngrouped: true }),
    [folders]
  );

  const choose = async (placement: TemplatePlacement) => {
    if (currentPlacement && placementsEqual(placement, currentPlacement)) {
      onOpenChange(false);
      return;
    }
    await onMove(placement);
    onOpenChange(false);
  };

  return (
    <ResponsiveModal open={open} onOpenChange={onOpenChange}>
      <ResponsiveModalContent className="sm:max-w-[26rem]">
        <ResponsiveModalHeader>
          <ResponsiveModalTitle>Move template</ResponsiveModalTitle>
          <ResponsiveModalDescription>Choose where {templateName} sits.</ResponsiveModalDescription>
        </ResponsiveModalHeader>

        <div className="max-h-[50dvh] overflow-y-auto overscroll-contain px-2 pb-2 sm:px-0">
          {targets.map((target) => {
            const current =
              currentPlacement != null && placementsEqual(target.placement, currentPlacement);
            const Icon =
              target.placement.category === 'custom' && target.placement.folderId
                ? Folder
                : FolderOpen;
            return (
              <button
                key={`${target.placement.category}-${target.placement.folderId ?? 'root'}`}
                type="button"
                disabled={busy}
                onClick={() => void choose(target.placement)}
                className={cn(
                  'flex min-h-[48px] w-full items-center gap-3 rounded-lg px-3 text-left text-sm transition-colors',
                  'hover:bg-muted focus-visible:bg-muted disabled:opacity-60',
                  current && 'text-primary font-medium'
                )}
              >
                <Icon className="size-4 shrink-0" aria-hidden />
                <span className="min-w-0 flex-1 truncate">{target.label}</span>
                {current ? <Check className="size-4 shrink-0" aria-hidden /> : null}
              </button>
            );
          })}
        </div>

        <ResponsiveModalFooter className="gap-1">
          <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
        </ResponsiveModalFooter>
      </ResponsiveModalContent>
    </ResponsiveModal>
  );
}

/** Confirms deleting one custom template. Deleting the content is not reversible. */
export function DeleteTemplateDialog({
  open,
  onOpenChange,
  templateName,
  busy,
  onConfirm,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  templateName: string;
  busy?: boolean;
  onConfirm: () => Promise<void> | void;
}) {
  return (
    <ResponsiveModal open={open} onOpenChange={onOpenChange}>
      <ResponsiveModalContent className="sm:max-w-[28rem]">
        <ResponsiveModalHeader>
          <ResponsiveModalTitle>Delete {templateName}?</ResponsiveModalTitle>
          <ResponsiveModalDescription>
            This removes the template and its content. You cannot undo it.
          </ResponsiveModalDescription>
        </ResponsiveModalHeader>
        <ResponsiveModalFooter className="gap-1">
          <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button
            type="button"
            variant="destructive"
            disabled={busy}
            onClick={async () => {
              await onConfirm();
              onOpenChange(false);
            }}
          >
            Delete template
          </Button>
        </ResponsiveModalFooter>
      </ResponsiveModalContent>
    </ResponsiveModal>
  );
}

/** Deleting a folder keeps its templates; they drop back to the Custom section. */
export function DeleteTemplateFolderDialog({
  open,
  onOpenChange,
  folderName,
  templateCount,
  busy,
  onConfirm,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  folderName: string;
  templateCount: number;
  busy?: boolean;
  onConfirm: () => Promise<void> | void;
}) {
  return (
    <ResponsiveModal open={open} onOpenChange={onOpenChange}>
      <ResponsiveModalContent className="sm:max-w-[28rem]">
        <ResponsiveModalHeader>
          <ResponsiveModalTitle>Delete {folderName}?</ResponsiveModalTitle>
          <ResponsiveModalDescription>
            {templateCount > 0
              ? `The ${templateCount} template${templateCount === 1 ? '' : 's'} inside move back to Custom. Nothing is deleted.`
              : 'The folder is empty, so nothing else changes.'}
          </ResponsiveModalDescription>
        </ResponsiveModalHeader>
        <ResponsiveModalFooter className="gap-1">
          <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button
            type="button"
            variant="destructive"
            disabled={busy}
            onClick={async () => {
              await onConfirm();
              onOpenChange(false);
            }}
          >
            Delete folder
          </Button>
        </ResponsiveModalFooter>
      </ResponsiveModalContent>
    </ResponsiveModal>
  );
}
