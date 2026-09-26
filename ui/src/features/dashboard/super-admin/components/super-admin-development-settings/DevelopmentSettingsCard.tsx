import { useCallback, useEffect, useMemo, useState } from 'react';

import { Link, useNavigate } from 'react-router-dom';

import {
  AlertTriangle,
  BookOpen,
  Building2,
  ChevronLeft,
  Megaphone,
  FileCheck2,
  Home,
  Image as ImageIcon,
  Info,
  Mail,
  MapPin,
  Save,
  Sparkles,
  Waves,
} from 'lucide-react';
import { toast } from 'sonner';

import { AdminPageHeader } from '@/features/dashboard/bookings/components/AdminPageHeader';
import {
  AdminSectionNavLayout,
  type AdminSectionNavItem,
} from '@/features/dashboard/bookings/components/AdminSectionNavLayout';
import type { PropertyMediaItem } from '@/features/dashboard/org/lib/propertySettingsConstants';
import { DevelopmentProfileSections } from '@/features/dashboard/super-admin/components/super-admin-development-settings/DevelopmentProfileSections';
import {
  useDeleteDevelopment,
  useDevelopment,
  useUpdateDevelopment,
} from '@/features/dashboard/super-admin/hooks/useDevelopments';
import { developmentMediaToLegacyFields } from '@/features/dashboard/super-admin/lib/developmentMedia';
import {
  buildDevelopmentUpdatePayload,
  developmentProfileDraftFromDevelopment,
  developmentProfileDraftIsDirty,
  validateDevelopmentProfileDraft,
  type DevelopmentProfileDraft,
} from '@/features/dashboard/super-admin/lib/developmentSettingsForm';
import { superAdminPaths } from '@/features/dashboard/super-admin/lib/superAdminPaths';

import { AppSettingsNavLayoutSkeleton } from '@/components/skeletons/AdminSkeletons';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import {
  ResponsiveModal,
  ResponsiveModalContent,
  ResponsiveModalFooter,
  ResponsiveModalHeader,
  ResponsiveModalTitle,
} from '@/components/ui/responsive-modal';
import { friendlyToastError } from '@/lib/feedback/toastMessages';

const SETTINGS_SECTIONS: AdminSectionNavItem[] = [
  { id: 'basic', label: 'Basic Information', icon: Info },
  { id: 'media', label: 'Photos & Videos', icon: ImageIcon },
  { id: 'email', label: 'Email automations', icon: Mail },
  { id: 'document-requirements', label: 'Document Requirements', icon: FileCheck2 },
  { id: 'unit-types', label: 'Unit types', icon: Home },
  { id: 'pool', label: 'Pool', icon: Waves },
  { id: 'guest-info', label: 'Guest information', icon: BookOpen },
  { id: 'announcements', label: 'Announcements', icon: Megaphone },
  { id: 'amenities', label: 'Amenities', icon: Sparkles },
  { id: 'location', label: 'Location', icon: MapPin },
  { id: 'towers', label: 'Towers & Parking', icon: Building2 },
  { id: 'danger', label: 'Danger Zone', icon: AlertTriangle },
];

type Props = {
  slug: string;
};

export function DevelopmentSettingsCard({ slug }: Props) {
  const navigate = useNavigate();
  const { data: development, isLoading, error } = useDevelopment(slug);
  const updateDevelopment = useUpdateDevelopment(slug);
  const deleteDevelopment = useDeleteDevelopment();
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [mediaGalleryBusy, setMediaGalleryBusy] = useState(false);

  const [baseline, setBaseline] = useState<DevelopmentProfileDraft | null>(null);
  const [draft, setDraft] = useState<DevelopmentProfileDraft | null>(null);

  useEffect(() => {
    if (!development) return;
    const next = developmentProfileDraftFromDevelopment(development);
    setBaseline(next);
    setDraft(next);
  }, [development?.id, development?.updatedAt]);

  const isDirty = useMemo(
    () => (baseline && draft ? developmentProfileDraftIsDirty(baseline, draft) : false),
    [baseline, draft]
  );

  const busy = updateDevelopment.isPending || deleteDevelopment.isPending || mediaGalleryBusy;

  const setDraftField = useCallback(
    <K extends keyof DevelopmentProfileDraft>(key: K, value: DevelopmentProfileDraft[K]) => {
      setDraft((current) => (current ? { ...current, [key]: value } : current));
    },
    []
  );

  const deleteBlockedReason = useMemo(() => {
    if (!development) return null;
    const { propertyCount, parkingCount } = development.stats;
    if (propertyCount > 0 || parkingCount > 0) {
      return 'Unlink or reassign linked properties and parking before deleting.';
    }
    return null;
  }, [development]);

  const handleMediaPersisted = (media: PropertyMediaItem[]) => {
    const legacy = developmentMediaToLegacyFields(media);
    setDraft((current) =>
      current
        ? {
            ...current,
            media: legacy.media,
            coverImageUrl: legacy.coverImageUrl,
            images: legacy.images,
          }
        : current
    );
    setBaseline((current) =>
      current
        ? {
            ...current,
            media: legacy.media,
            coverImageUrl: legacy.coverImageUrl,
            images: legacy.images,
          }
        : current
    );
  };

  const persistMediaOrder = async (media: PropertyMediaItem[]) => {
    if (!development) return;
    setMediaGalleryBusy(true);
    try {
      const legacy = developmentMediaToLegacyFields(media);
      const result = await updateDevelopment.mutateAsync({
        developmentId: development.id,
        media: legacy.media,
        coverImageUrl: legacy.coverImageUrl || null,
        images: legacy.images,
      });
      const saved = developmentProfileDraftFromDevelopment(result);
      handleMediaPersisted(saved.media);
    } finally {
      setMediaGalleryBusy(false);
    }
  };

  const handleSave = async () => {
    if (!development || !draft) return;
    const validationError = validateDevelopmentProfileDraft(draft);
    if (validationError) {
      toast.error(validationError);
      return;
    }
    try {
      const result = await updateDevelopment.mutateAsync({
        developmentId: development.id,
        ...buildDevelopmentUpdatePayload(draft),
      });
      const saved = developmentProfileDraftFromDevelopment(result);
      setBaseline(saved);
      setDraft(saved);
      if (result.slug !== slug) {
        navigate(superAdminPaths.developmentDetail(result.slug), { replace: true });
      }
      toast.success('Settings saved');
    } catch (err) {
      toast.error(friendlyToastError(err, 'Could not save settings'));
    }
  };

  const handleDelete = async () => {
    if (!development) return;
    try {
      await deleteDevelopment.mutateAsync(development.id);
      toast.success('Development deleted');
      navigate(superAdminPaths.developments, { replace: true });
    } catch (err) {
      toast.error(friendlyToastError(err, 'Could not delete development'));
    } finally {
      setDeleteOpen(false);
    }
  };

  if (error && !development) {
    return <p className="text-destructive text-sm">Development not found.</p>;
  }

  const headerTitle = development?.name ?? 'Development';

  return (
    <>
      <AdminSectionNavLayout
        className="min-h-0 flex-1"
        sections={SETTINGS_SECTIONS}
        header={
          <div className="space-y-1.5">
            <Link
              to={superAdminPaths.developments}
              className="text-muted-foreground hover:text-foreground inline-flex min-h-[44px] items-center gap-1 text-sm font-medium transition-colors"
            >
              <ChevronLeft className="size-4" aria-hidden />
              Developments
            </Link>
            <AdminPageHeader
              variant="compact"
              title={headerTitle}
              subtitle="Profile and media for this development."
              actions={
                isDirty && draft ? (
                  <Button
                    type="button"
                    onClick={() => void handleSave()}
                    disabled={busy}
                    className="min-h-[44px] gap-1.5 lg:hidden"
                  >
                    <Save className="size-4" aria-hidden />
                    {busy ? 'Saving…' : 'Save Changes'}
                  </Button>
                ) : null
              }
            />
          </div>
        }
        footer={
          isDirty && draft ? (
            <Card className="border-amber-200 bg-amber-50 dark:border-amber-900 dark:bg-amber-950/30">
              <CardContent className="flex flex-col gap-3 p-4 sm:flex-row sm:items-center sm:justify-between">
                <div className="flex items-center gap-2">
                  <div className="size-2 animate-pulse rounded-full bg-amber-500" />
                  <p className="text-sm font-medium text-amber-800 dark:text-amber-200">
                    Unsaved changes
                  </p>
                </div>
                <Button
                  type="button"
                  onClick={() => void handleSave()}
                  disabled={busy}
                  className="min-h-[44px] w-full sm:w-auto"
                  size="sm"
                >
                  {busy ? 'Saving…' : 'Save Changes'}
                </Button>
              </CardContent>
            </Card>
          ) : null
        }
      >
        {isLoading || !draft || !development ? (
          <AppSettingsNavLayoutSkeleton />
        ) : (
          <DevelopmentProfileSections
            developmentId={development.id}
            draft={draft}
            onChange={setDraftField}
            disabled={busy}
            deleteBlockedReason={deleteBlockedReason}
            busy={busy}
            onDelete={() => setDeleteOpen(true)}
            onMediaPersisted={handleMediaPersisted}
            onPersistMediaOrder={persistMediaOrder}
            mediaGalleryBusy={mediaGalleryBusy}
          />
        )}
      </AdminSectionNavLayout>

      {development ? (
        <ResponsiveModal open={deleteOpen} onOpenChange={setDeleteOpen}>
          <ResponsiveModalContent className="max-w-[min(calc(100vw-1.5rem),28rem)]">
            <ResponsiveModalHeader>
              <ResponsiveModalTitle>Delete development?</ResponsiveModalTitle>
            </ResponsiveModalHeader>
            <p className="text-muted-foreground text-sm">
              This permanently removes {development.name}. This cannot be undone.
            </p>
            <ResponsiveModalFooter className="gap-2 sm:gap-0">
              <Button type="button" variant="outline" onClick={() => setDeleteOpen(false)}>
                Cancel
              </Button>
              <Button
                type="button"
                variant="destructive"
                disabled={busy}
                onClick={() => void handleDelete()}
              >
                Delete
              </Button>
            </ResponsiveModalFooter>
          </ResponsiveModalContent>
        </ResponsiveModal>
      ) : null}
    </>
  );
}
