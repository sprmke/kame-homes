import * as React from 'react';

import { useSearchParams } from 'react-router-dom';

import { FileText, FolderPlus, Plus, RefreshCw } from 'lucide-react';

import { AddCustomTemplateDialog } from '@/features/dashboard/bookings/components/property-templates/AddCustomTemplateDialog';
import { PropertyTemplateEditorPane } from '@/features/dashboard/bookings/components/property-templates/PropertyTemplateEditorPane';
import {
  DeleteTemplateDialog,
  DeleteTemplateFolderDialog,
  TemplateMoveDialog,
  TemplateNamePromptDialog,
} from '@/features/dashboard/bookings/components/property-templates/TemplateOrganiseDialogs';
import { TemplateWorkbench } from '@/features/dashboard/bookings/components/property-templates/TemplateWorkbench';
import {
  usePropertyTemplateMutations,
  usePropertyTemplates,
  type PropertyTemplateDto,
} from '@/features/dashboard/bookings/hooks/usePropertyTemplates';
import {
  buildTemplateLibrary,
  findTemplateLibraryEntry,
  resolveSelectedTemplateKey,
  type TemplateCategoryFilter,
  type TemplateLibraryEntry,
  type TemplateLibraryGroup,
  type TemplatePlacement,
} from '@/features/dashboard/bookings/lib/templateLibrary';
import { TierBadgeAnchor } from '@/features/dashboard/plans/components/TierBadge';
import { useUpgradeModal } from '@/features/dashboard/plans/components/UpgradeModalProvider';
import { useFeatureGate } from '@/features/dashboard/plans/hooks/useFeatureGate';
import { usePropertyPermissions } from '@/features/dashboard/team/hooks/usePropertyPermissions';
import { hasPropertyPermission } from '@/features/dashboard/team/lib/propertyPermissions';

import { AdminMobilePage } from '@/components/mobile/MobileBrandHero';
import {
  MobileHeroActionMenu,
  type MobileHeroActionMenuItem,
} from '@/components/mobile/MobileHeroActionButton';
import { TemplateWorkbenchSkeleton } from '@/components/skeletons/TemplateWorkbenchSkeleton';
import { Button } from '@/components/ui/button';
import { useIsBelowLg } from '@/hooks/useMediaQuery';

const TEMPLATE_PARAM = 'template';

/** Mirrors the server limits so the host hits the input cap, not a 400. */
const TEMPLATE_NAME_MAX = 120;
const FOLDER_NAME_MAX = 40;

/**
 * Which organise dialog is open, and what it acts on. One slot keeps the page
 * from juggling six booleans that could ever be true at once.
 */
type OrganiseTarget =
  | { kind: 'rename-template'; entry: TemplateLibraryEntry }
  | { kind: 'move-template'; entry: TemplateLibraryEntry }
  | { kind: 'delete-template'; entry: TemplateLibraryEntry }
  | { kind: 'create-folder' }
  | { kind: 'rename-folder'; group: TemplateLibraryGroup }
  | { kind: 'delete-folder'; group: TemplateLibraryGroup };

/** Centered panel message for the states where there is no editor to show. */
function TemplatePaneMessage({
  title,
  body,
  action,
}: {
  title: string;
  body: string;
  action?: React.ReactNode;
}) {
  return (
    <div className="flex min-h-0 flex-1 flex-col items-center justify-center gap-3 p-6 text-center">
      <div className="bg-muted text-muted-foreground flex size-10 items-center justify-center rounded-lg">
        <FileText className="size-5" aria-hidden />
      </div>
      <div className="space-y-1">
        <p className="text-card-title">{title}</p>
        <p className="text-muted-foreground mx-auto max-w-xs text-sm">{body}</p>
      </div>
      {action}
    </div>
  );
}

export function TemplatesPage() {
  const { data, isLoading, error, refetch } = usePropertyTemplates();
  const {
    saveTemplate,
    resetTemplate,
    createCustomTemplate,
    deleteCustomTemplate,
    renameCustomTemplate,
    moveCustomTemplate,
    createTemplateFolder,
    renameTemplateFolder,
    deleteTemplateFolder,
  } = usePropertyTemplateMutations();
  const { data: propertyAccess } = usePropertyPermissions();
  const [searchParams, setSearchParams] = useSearchParams();
  const isMobile = useIsBelowLg();
  const [query, setQuery] = React.useState('');
  const [categoryFilter, setCategoryFilter] = React.useState<TemplateCategoryFilter>('all');
  const [organise, setOrganise] = React.useState<OrganiseTarget | null>(null);
  const [addTemplateOpen, setAddTemplateOpen] = React.useState(false);
  const [addTemplateInitialPlacement, setAddTemplateInitialPlacement] =
    React.useState<TemplatePlacement | null>(null);
  const { canUse: canUseCustomTemplates, isLoading: customTemplatesLoading } =
    useFeatureGate('customTemplates');
  const { open: openUpgradeModal } = useUpgradeModal();

  const canEditStandard = hasPropertyPermission(
    propertyAccess?.permissions,
    'templates.standard:edit'
  );
  const canEditEmail = hasPropertyPermission(propertyAccess?.permissions, 'templates.email:edit');
  const canAddCustom = hasPropertyPermission(propertyAccess?.permissions, 'templates.custom:add');
  const canEditCustom = hasPropertyPermission(propertyAccess?.permissions, 'templates.custom:edit');
  const canDeleteCustom = hasPropertyPermission(
    propertyAccess?.permissions,
    'templates.custom:delete'
  );

  const groups = React.useMemo(
    () => buildTemplateLibrary(data?.templates, data?.folders),
    [data?.templates, data?.folders]
  );
  const requestedKey = searchParams.get(TEMPLATE_PARAM);

  /* Phone opens an editor only on an explicit, still-existing selection, so the
   * list stays the landing view. Desktop always resolves to a template so the
   * right pane is never blank. */
  const openKey = findTemplateLibraryEntry(groups, requestedKey)?.templateKey ?? null;
  const activeKey = isMobile ? openKey : resolveSelectedTemplateKey(groups, requestedKey);
  const activeEntry = findTemplateLibraryEntry(groups, activeKey);

  const selectTemplate = React.useCallback(
    (templateKey: string | null, options?: { replace?: boolean }) => {
      setSearchParams(
        (previous) => {
          const next = new URLSearchParams(previous);
          if (templateKey) next.set(TEMPLATE_PARAM, templateKey);
          else next.delete(TEMPLATE_PARAM);
          return next;
        },
        { replace: options?.replace ?? false }
      );
    },
    [setSearchParams]
  );

  const handleSave = async (
    templateKey: string,
    input: { content: string; sectionImageUrl?: string | null }
  ) => {
    await saveTemplate.mutateAsync({ templateKey, ...input });
  };

  const handleReset = async (template: PropertyTemplateDto) => {
    await resetTemplate.mutateAsync(template.templateKey);
  };

  const handleDelete = async (templateKey: string) => {
    await deleteCustomTemplate.mutateAsync(templateKey);
    /* The open template is gone; drop the stale param instead of leaving a
     * deep link pointing at a deleted key. */
    if (requestedKey === templateKey) selectTemplate(null, { replace: true });
  };

  const permissions = React.useMemo(
    () => ({ canAddCustom, canEditCustom, canDeleteCustom }),
    [canAddCustom, canEditCustom, canDeleteCustom]
  );

  const ensureCustomTemplates = React.useCallback(() => {
    if (!canUseCustomTemplates) {
      if (!customTemplatesLoading) openUpgradeModal('customTemplates');
      return false;
    }
    return true;
  }, [canUseCustomTemplates, customTemplatesLoading, openUpgradeModal]);

  const openNewGroup = React.useCallback(() => {
    if (!ensureCustomTemplates()) return;
    setOrganise({ kind: 'create-folder' });
  }, [ensureCustomTemplates]);

  const openAddTemplate = React.useCallback(() => {
    if (!ensureCustomTemplates()) return;
    setAddTemplateInitialPlacement(null);
    setAddTemplateOpen(true);
  }, [ensureCustomTemplates]);

  const openAddTemplateInGroup = React.useCallback(
    (group: TemplateLibraryGroup) => {
      if (!ensureCustomTemplates()) return;
      if (group.kind === 'builtin' && (group.id === 'standard' || group.id === 'email')) {
        setAddTemplateInitialPlacement({ category: group.id, folderId: null });
      } else if (group.kind === 'folder' && group.folderId) {
        setAddTemplateInitialPlacement({ category: 'custom', folderId: group.folderId });
      } else if (group.kind === 'ungrouped') {
        setAddTemplateInitialPlacement({ category: 'custom', folderId: null });
      } else {
        setAddTemplateInitialPlacement(null);
      }
      setAddTemplateOpen(true);
    },
    [ensureCustomTemplates]
  );

  const handlers = React.useMemo(
    () => ({
      onRenameTemplate: (entry: TemplateLibraryEntry) =>
        setOrganise({ kind: 'rename-template', entry }),
      onMoveTemplate: (entry: TemplateLibraryEntry) =>
        setOrganise({ kind: 'move-template', entry }),
      onDeleteTemplate: (entry: TemplateLibraryEntry) =>
        setOrganise({ kind: 'delete-template', entry }),
      onRenameFolder: (group: TemplateLibraryGroup) =>
        setOrganise({ kind: 'rename-folder', group }),
      onDeleteFolder: (group: TemplateLibraryGroup) =>
        setOrganise({ kind: 'delete-folder', group }),
      onAddTemplateToGroup: openAddTemplateInGroup,
    }),
    [openAddTemplateInGroup]
  );

  const closeOrganise = React.useCallback((open: boolean) => {
    if (!open) setOrganise(null);
  }, []);

  const railOverlayRemeasureKey = `${addTemplateOpen}-${organise?.kind ?? 'idle'}`;

  const heroMenuItems = React.useMemo((): MobileHeroActionMenuItem[] => {
    if (!canAddCustom) return [];
    return [
      {
        key: 'add-template',
        label: 'Add template',
        Icon: Plus,
        onSelect: openAddTemplate,
      },
      {
        key: 'new-group',
        label: 'New group',
        Icon: FolderPlus,
        onSelect: openNewGroup,
      },
    ];
  }, [canAddCustom, openAddTemplate, openNewGroup]);

  const templateHeaderActions = canAddCustom ? (
    <div className="flex w-full flex-col gap-2 sm:w-auto sm:flex-row sm:items-center sm:justify-end sm:gap-2">
      <TierBadgeAnchor feature="customTemplates">
        <Button
          type="button"
          variant="outline"
          className="min-h-[44px] gap-1.5"
          onClick={openNewGroup}
        >
          <FolderPlus className="size-4" aria-hidden />
          New group
        </Button>
      </TierBadgeAnchor>
      <TierBadgeAnchor feature="customTemplates">
        <Button
          type="button"
          variant="default"
          className="min-h-[44px] gap-1.5"
          onClick={openAddTemplate}
        >
          <Plus className="size-4" aria-hidden />
          Add Template
        </Button>
      </TierBadgeAnchor>
    </div>
  ) : null;

  const canEditActive = activeEntry
    ? activeEntry.category === 'standard'
      ? canEditStandard
      : activeEntry.category === 'email'
        ? canEditEmail
        : canEditCustom
    : false;

  const detail = (() => {
    if (!activeEntry) {
      return (
        <TemplatePaneMessage
          title="No templates yet"
          body="Templates load with the property. Reload if this looks wrong."
          action={
            <Button type="button" variant="outline" size="sm" onClick={() => void refetch()}>
              Reload
            </Button>
          }
        />
      );
    }

    const isCustom = activeEntry.organisable;

    return (
      <PropertyTemplateEditorPane
        key={activeEntry.templateKey}
        entry={activeEntry}
        saving={saveTemplate.isPending || resetTemplate.isPending}
        showSectionImage={false}
        canEdit={canEditActive}
        onBack={isMobile ? () => selectTemplate(null) : undefined}
        onSave={(input) => handleSave(activeEntry.templateKey, input)}
        onRename={
          isCustom && canEditCustom ? () => handlers.onRenameTemplate(activeEntry) : undefined
        }
        onMove={isCustom && canEditCustom ? () => handlers.onMoveTemplate(activeEntry) : undefined}
        onReset={
          !isCustom && canEditActive ? () => void handleReset(activeEntry.template) : undefined
        }
        onDelete={
          isCustom && canDeleteCustom ? () => void handleDelete(activeEntry.templateKey) : undefined
        }
      />
    );
  })();

  return (
    <AdminMobilePage
      title="Templates"
      subtitle="Manage your property's house rules, instructions, and email templates."
      titleId="templates-heading"
      heroTrailing={
        heroMenuItems.length > 0 ? (
          <MobileHeroActionMenu items={heroMenuItems} label="Template actions" />
        ) : null
      }
      desktopActions={templateHeaderActions}
    >
      {isLoading ? <TemplateWorkbenchSkeleton /> : null}

      {error && !data ? (
        <div className="border-border bg-card flex min-h-0 flex-1 flex-col items-center justify-center gap-3 rounded-xl border p-6 text-center">
          <p className="text-card-title">Templates did not load</p>
          <p className="text-muted-foreground max-w-sm text-sm">
            Check your connection and try again.
          </p>
          <Button type="button" variant="outline" onClick={() => void refetch()}>
            <RefreshCw className="size-4" aria-hidden />
            Try again
          </Button>
        </div>
      ) : null}

      {data ? (
        <TemplateWorkbench
          groups={groups}
          selectedKey={activeKey}
          onSelect={selectTemplate}
          query={query}
          onQueryChange={setQuery}
          categoryFilter={categoryFilter}
          onCategoryFilterChange={setCategoryFilter}
          isMobile={isMobile}
          showDetail={Boolean(openKey)}
          permissions={permissions}
          handlers={handlers}
          detail={detail}
          overlayRemeasureKey={railOverlayRemeasureKey}
        />
      ) : null}

      <TemplateNamePromptDialog
        open={organise?.kind === 'rename-template'}
        onOpenChange={closeOrganise}
        title="Rename template"
        label="Template name"
        initialValue={organise?.kind === 'rename-template' ? organise.entry.name : ''}
        confirmLabel="Save name"
        maxLength={TEMPLATE_NAME_MAX}
        busy={renameCustomTemplate.isPending}
        onSubmit={async (name) => {
          if (organise?.kind !== 'rename-template') return;
          await renameCustomTemplate.mutateAsync({
            templateKey: organise.entry.templateKey,
            name,
          });
        }}
      />

      <TemplateMoveDialog
        open={organise?.kind === 'move-template'}
        onOpenChange={closeOrganise}
        templateName={organise?.kind === 'move-template' ? organise.entry.name : ''}
        entry={organise?.kind === 'move-template' ? organise.entry : null}
        folders={data?.folders ?? []}
        busy={moveCustomTemplate.isPending}
        onMove={async (placement) => {
          if (organise?.kind !== 'move-template') return;
          await moveCustomTemplate.mutateAsync({
            templateKey: organise.entry.templateKey,
            category: placement.category,
            folderId: placement.category === 'custom' ? placement.folderId : null,
          });
        }}
      />

      <DeleteTemplateDialog
        open={organise?.kind === 'delete-template'}
        onOpenChange={closeOrganise}
        templateName={organise?.kind === 'delete-template' ? organise.entry.name : ''}
        busy={deleteCustomTemplate.isPending}
        onConfirm={async () => {
          if (organise?.kind !== 'delete-template') return;
          await handleDelete(organise.entry.templateKey);
        }}
      />

      {canAddCustom ? (
        <AddCustomTemplateDialog
          open={addTemplateOpen}
          onOpenChange={setAddTemplateOpen}
          hideTrigger
          busy={createCustomTemplate.isPending}
          folders={data?.folders}
          initialPlacement={addTemplateInitialPlacement}
          onRequestNewGroup={openNewGroup}
          onAdd={async (input) => {
            const { templateKey } = await createCustomTemplate.mutateAsync(input);
            if (templateKey) selectTemplate(templateKey);
          }}
        />
      ) : null}

      <TemplateNamePromptDialog
        open={organise?.kind === 'create-folder'}
        onOpenChange={closeOrganise}
        title="New group"
        description="Group your custom templates however you work."
        label="Group name"
        initialValue=""
        confirmLabel="Create group"
        maxLength={FOLDER_NAME_MAX}
        busy={createTemplateFolder.isPending}
        onSubmit={async (name) => {
          await createTemplateFolder.mutateAsync({ name });
        }}
      />

      <TemplateNamePromptDialog
        open={organise?.kind === 'rename-folder'}
        onOpenChange={closeOrganise}
        title="Rename folder"
        label="Folder name"
        initialValue={organise?.kind === 'rename-folder' ? organise.group.label : ''}
        confirmLabel="Save name"
        maxLength={FOLDER_NAME_MAX}
        busy={renameTemplateFolder.isPending}
        onSubmit={async (name) => {
          if (organise?.kind !== 'rename-folder' || !organise.group.folderId) return;
          await renameTemplateFolder.mutateAsync({ folderId: organise.group.folderId, name });
        }}
      />

      <DeleteTemplateFolderDialog
        open={organise?.kind === 'delete-folder'}
        onOpenChange={closeOrganise}
        folderName={organise?.kind === 'delete-folder' ? organise.group.label : ''}
        templateCount={organise?.kind === 'delete-folder' ? organise.group.entries.length : 0}
        busy={deleteTemplateFolder.isPending}
        onConfirm={async () => {
          if (organise?.kind !== 'delete-folder' || !organise.group.folderId) return;
          await deleteTemplateFolder.mutateAsync({ folderId: organise.group.folderId });
        }}
      />
    </AdminMobilePage>
  );
}
