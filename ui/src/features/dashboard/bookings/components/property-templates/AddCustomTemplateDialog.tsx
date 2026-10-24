import * as React from 'react';

import { Plus } from 'lucide-react';

import { RichTextEditor } from '@/features/dashboard/bookings/components/property-templates/RichTextEditor';
import type {
  PropertyTemplateCategory,
  PropertyTemplateFolderDto,
} from '@/features/dashboard/bookings/hooks/usePropertyTemplates';
import {
  groupSelectValueFromPlacement,
  placementFromGroupSelectValue,
  TEMPLATE_GROUP_SELECT,
  templatePlacementTargets,
  type TemplatePlacement,
} from '@/features/dashboard/bookings/lib/templateLibrary';
import { TierBadgeAnchor } from '@/features/dashboard/plans/components/TierBadge';
import { useUpgradeModal } from '@/features/dashboard/plans/components/UpgradeModalProvider';
import { useFeatureGate } from '@/features/dashboard/plans/hooks/useFeatureGate';

import { UnsavedChangesDialog } from '@/components/forms/UnsavedChangesDialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  ResponsiveModal,
  ResponsiveModalContent,
  ResponsiveModalFooter,
  ResponsiveModalHeader,
  ResponsiveModalTitle,
} from '@/components/ui/responsive-modal';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectSeparator,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { useGuardedClose } from '@/hooks/useGuardedClose';

const DEFAULT_PLACEMENT: TemplatePlacement = { category: 'standard', folderId: null };

function draftHasImageMarkup(html: string): boolean {
  const openTag = String.fromCharCode(60) + 'img';
  return html.toLowerCase().includes(openTag);
}

type Props = {
  onAdd: (input: {
    name: string;
    content: string;
    category: PropertyTemplateCategory;
    folderId: string | null;
  }) => Promise<void>;
  busy?: boolean;
  trigger?: React.ReactNode;
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
  hideTrigger?: boolean;
  folders?: PropertyTemplateFolderDto[];
  initialPlacement?: TemplatePlacement | null;
  onRequestNewGroup?: () => void;
};

export function AddCustomTemplateDialog({
  onAdd,
  busy,
  trigger,
  open: controlledOpen,
  onOpenChange: controlledOnOpenChange,
  hideTrigger,
  folders,
  initialPlacement = null,
  onRequestNewGroup,
}: Props) {
  const [internalOpen, setInternalOpen] = React.useState(false);
  const isControlled = controlledOpen !== undefined;
  const open = isControlled ? controlledOpen : internalOpen;
  const setOpen = React.useCallback(
    (next: boolean) => {
      if (isControlled) controlledOnOpenChange?.(next);
      else setInternalOpen(next);
    },
    [controlledOnOpenChange, isControlled]
  );
  const [name, setName] = React.useState('');
  const [content, setContent] = React.useState('');
  const [placement, setPlacement] = React.useState<TemplatePlacement>(DEFAULT_PLACEMENT);
  const groupTargets = React.useMemo(() => templatePlacementTargets(folders), [folders]);
  const groupSelectValue = groupSelectValueFromPlacement(placement);
  const folderIdsOnOpenRef = React.useRef<string[]>([]);
  const wasOpenRef = React.useRef(false);
  const { canUse: canUseCustomTemplates, isLoading: customTemplatesLoading } =
    useFeatureGate('customTemplates');
  const { open: openUpgradeModal } = useUpgradeModal();

  const openCreateOrUpgrade = React.useCallback(() => {
    if (!canUseCustomTemplates) {
      if (!customTemplatesLoading) openUpgradeModal('customTemplates');
      return;
    }
    setOpen(true);
  }, [canUseCustomTemplates, customTemplatesLoading, openUpgradeModal]);

  const resetDraft = React.useCallback(() => {
    setName('');
    setContent('');
    setPlacement(DEFAULT_PLACEMENT);
  }, []);

  React.useEffect(() => {
    if (open && !wasOpenRef.current) {
      folderIdsOnOpenRef.current = (folders ?? []).map((folder) => folder.id);
    }
    wasOpenRef.current = open;
  }, [open, folders]);

  React.useEffect(() => {
    if (!open) return;
    setPlacement(initialPlacement ?? DEFAULT_PLACEMENT);
  }, [open, initialPlacement]);

  React.useEffect(() => {
    if (!open || placement.category !== 'custom') return;
    const list = folders ?? [];
    const snapshot = new Set(folderIdsOnOpenRef.current);
    const created = list.filter((folder) => !snapshot.has(folder.id));
    if (created.length === 1) {
      setPlacement({ category: 'custom', folderId: created[0]!.id });
    }
    if (created.length > 0) {
      folderIdsOnOpenRef.current = list.map((folder) => folder.id);
    }
  }, [open, folders, placement.category]);

  const handleAdd = async (): Promise<boolean> => {
    if (!name.trim()) return false;
    try {
      await onAdd({
        name: name.trim(),
        content,
        category: placement.category,
        folderId: placement.category === 'custom' ? placement.folderId : null,
      });
    } catch {
      return false;
    }
    resetDraft();
    setOpen(false);
    return true;
  };

  const contentHasValue =
    draftHasImageMarkup(content) || content.replace(/<[^>]*>/g, '').trim() !== '';
  const { onOpenChange, requestClose, dialogProps } = useGuardedClose({
    open,
    onOpenChange: setOpen,
    isDirty: name.trim() !== '' || contentHasValue,
    onSave: name.trim() ? handleAdd : undefined,
    onDiscard: resetDraft,
  });

  const defaultTrigger = (
    <Button type="button" variant="default" size="sm" className="min-h-[44px]">
      <Plus className="mr-2 h-4 w-4" />
      Add Template
    </Button>
  );

  const triggerNode = trigger ?? defaultTrigger;

  return (
    <>
      {hideTrigger ? null : (
        <TierBadgeAnchor feature="customTemplates">
          {React.isValidElement(triggerNode) ? (
            React.cloneElement(
              triggerNode as React.ReactElement<{ onClick?: (e: React.MouseEvent) => void }>,
              {
                onClick: (e: React.MouseEvent) => {
                  (
                    triggerNode as React.ReactElement<{ onClick?: (e: React.MouseEvent) => void }>
                  ).props.onClick?.(e);
                  if (e.defaultPrevented) return;
                  openCreateOrUpgrade();
                },
              }
            )
          ) : (
            <button type="button" onClick={openCreateOrUpgrade}>
              {triggerNode}
            </button>
          )}
        </TierBadgeAnchor>
      )}

      <ResponsiveModal open={open} onOpenChange={onOpenChange}>
        <ResponsiveModalContent
          sheetLayout="split"
          className="flex max-h-[min(92dvh,720px)] max-w-[min(calc(100vw-1.5rem),42rem)] flex-col gap-0 overflow-hidden p-0 sm:max-w-[min(95vw,42rem)] sm:p-0"
        >
          <ResponsiveModalHeader className="border-border/60 shrink-0 space-y-0 border-b px-4 py-3 sm:px-5 sm:py-4">
            <ResponsiveModalTitle className="pr-8 text-base sm:text-lg">
              Create custom template
            </ResponsiveModalTitle>
          </ResponsiveModalHeader>
          <div className="min-h-0 flex-1 space-y-4 overflow-y-auto overscroll-contain px-4 py-4 [-webkit-overflow-scrolling:touch] sm:px-5">
            <div className="space-y-2">
              <Label htmlFor="custom-template-name">Name</Label>
              <Input
                id="custom-template-name"
                value={name}
                onChange={(e) => setName(e.target.value)}
                maxLength={120}
                className="h-10"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="custom-template-folder">Group</Label>
              <Select
                value={groupSelectValue}
                onValueChange={(value) => {
                  if (value === TEMPLATE_GROUP_SELECT.NEW_GROUP) {
                    onRequestNewGroup?.();
                    return;
                  }
                  const next = placementFromGroupSelectValue(value, folders);
                  if (next) setPlacement(next);
                }}
              >
                <SelectTrigger id="custom-template-folder" className="h-10">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {groupTargets.map((target) => (
                    <SelectItem
                      key={groupSelectValueFromPlacement(target.placement)}
                      value={groupSelectValueFromPlacement(target.placement)}
                    >
                      {target.label}
                    </SelectItem>
                  ))}
                  {onRequestNewGroup ? (
                    <>
                      <SelectSeparator />
                      <SelectItem value={TEMPLATE_GROUP_SELECT.NEW_GROUP} className="text-primary">
                        <span className="flex items-center gap-2">
                          <Plus className="size-4 shrink-0" aria-hidden />
                          New group
                        </span>
                      </SelectItem>
                    </>
                  ) : null}
                </SelectContent>
              </Select>
            </div>
            <RichTextEditor content={content} onChange={setContent} minHeight="240px" />
          </div>
          <ResponsiveModalFooter className="border-border/60 shrink-0 gap-2 border-t px-4 py-3 sm:px-5">
            <Button type="button" variant="outline" onClick={requestClose}>
              Cancel
            </Button>
            <Button type="button" disabled={busy || !name.trim()} onClick={() => void handleAdd()}>
              Create
            </Button>
          </ResponsiveModalFooter>
        </ResponsiveModalContent>
      </ResponsiveModal>
      <UnsavedChangesDialog {...dialogProps} />
    </>
  );
}
