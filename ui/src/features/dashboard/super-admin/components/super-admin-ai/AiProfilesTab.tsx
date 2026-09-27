import * as React from 'react';

import { Plus } from 'lucide-react';
import { toast } from 'sonner';

import { AiProfileDialog } from '@/features/dashboard/super-admin/components/super-admin-ai/AiProfileDialog';
import {
  useAiLimitsAction,
  useAiLimitsProfiles,
  type AiLimitProfile,
  type AiLimitProfileUsage,
} from '@/features/dashboard/super-admin/hooks/useSuperAdminAiLimits';
import {
  AI_LIMIT_FIELDS,
  AI_LIMIT_KEYS,
  formatLimitValue,
} from '@/features/dashboard/super-admin/lib/aiLimits';

import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Skeleton } from '@/components/ui/skeleton';
import { friendlyToastError } from '@/lib/feedback/toastMessages';

const NONE = '__none__';

type ProfileWithUsage = AiLimitProfile & { usage: AiLimitProfileUsage };

function ProfileCard({
  profile,
  onEdit,
  onDelete,
  deleting,
}: {
  profile: ProfileWithUsage;
  onEdit: () => void;
  onDelete: () => void;
  deleting: boolean;
}) {
  const setKeys = AI_LIMIT_KEYS.filter((key) => profile.limits[key] !== null);
  const { usage } = profile;
  const assigned =
    usage.organizationAssignments + usage.propertyAssignments + usage.developmentAssignments;
  const canDelete = !profile.isDefault && assigned === 0 && usage.plans.length === 0;

  return (
    <Card padding="sm" className="flex min-w-0 flex-col gap-3">
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <p className="truncate font-medium">{profile.name}</p>
          <p className="text-muted-foreground truncate text-xs">{profile.code}</p>
        </div>
        {profile.isDefault ? <Badge variant="secondary">Default</Badge> : null}
      </div>

      {setKeys.length > 0 ? (
        <dl className="grid grid-cols-2 gap-x-3 gap-y-1 text-xs">
          {setKeys.slice(0, 6).map((key) => (
            <div key={key} className="flex min-w-0 justify-between gap-2">
              <dt className="text-muted-foreground truncate">{AI_LIMIT_FIELDS[key].label}</dt>
              <dd className="tabular-nums">{formatLimitValue(key, profile.limits[key])}</dd>
            </div>
          ))}
          {setKeys.length > 6 ? (
            <div className="text-muted-foreground col-span-2">+{setKeys.length - 6} more</div>
          ) : null}
        </dl>
      ) : (
        <p className="text-muted-foreground text-xs">Inherits every limit.</p>
      )}

      <div className="text-muted-foreground flex flex-wrap gap-x-3 gap-y-1 text-xs">
        <span>{usage.affectedOrganizations} orgs</span>
        <span>${usage.spend30dUsd.toLocaleString('en-US')} / 30d</span>
        {usage.plans.length > 0 ? (
          <span>Plans: {usage.plans.map((p) => p.name).join(', ')}</span>
        ) : null}
        {assigned > 0 ? <span>{assigned} assigned</span> : null}
      </div>

      <div className="mt-auto flex gap-2">
        <Button type="button" size="sm" variant="outline" onClick={onEdit}>
          Edit
        </Button>
        {canDelete ? (
          <Button type="button" size="sm" variant="ghost" onClick={onDelete} disabled={deleting}>
            Delete
          </Button>
        ) : null}
      </div>
    </Card>
  );
}

export function AiProfilesTab() {
  const { data, isLoading, error } = useAiLimitsProfiles();
  const action = useAiLimitsAction();
  const [editing, setEditing] = React.useState<ProfileWithUsage | null>(null);
  const [dialogOpen, setDialogOpen] = React.useState(false);
  const [deleteTarget, setDeleteTarget] = React.useState<ProfileWithUsage | null>(null);

  const profiles = data?.profiles ?? [];

  const openCreate = () => {
    setEditing(null);
    setDialogOpen(true);
  };
  const openEdit = (profile: ProfileWithUsage) => {
    setEditing(profile);
    setDialogOpen(true);
  };

  const confirmDelete = () => {
    if (!deleteTarget) return;
    action.mutate(
      { action: 'delete_profile', profileId: deleteTarget.id },
      {
        onSuccess: () => toast.success('Profile deleted'),
        onError: (err: unknown) => toast.error(friendlyToastError(err, 'Could not delete profile')),
        onSettled: () => setDeleteTarget(null),
      }
    );
  };

  const bindPlan = (planId: string, value: string) =>
    action.mutate(
      { action: 'set_plan_profile', planId, profileId: value === NONE ? null : value },
      {
        onSuccess: () => toast.success('Plan updated'),
        onError: (err: unknown) => toast.error(friendlyToastError(err, 'Could not update plan')),
      }
    );

  const assignDevelopment = (developmentId: string, value: string) =>
    action.mutate(
      {
        action: 'assign',
        scope: 'development',
        scopeIds: [developmentId],
        profileId: value === NONE ? null : value,
      },
      {
        onSuccess: () => toast.success('Development updated'),
        onError: (err: unknown) =>
          toast.error(friendlyToastError(err, 'Could not update development')),
      }
    );

  if (isLoading && !data) {
    return (
      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3" aria-label="Loading profiles">
        {Array.from({ length: 3 }).map((_, i) => (
          <Skeleton key={i} className="h-44 w-full" />
        ))}
      </div>
    );
  }
  if (error || !data) return <p className="text-destructive text-sm">Could not load profiles.</p>;

  const profileSelect = (
    value: string | null,
    onChange: (value: string) => void,
    label: string
  ) => (
    <Select value={value ?? NONE} onValueChange={onChange} disabled={action.isPending}>
      <SelectTrigger className="h-10 w-full sm:w-52" aria-label={label}>
        <SelectValue />
      </SelectTrigger>
      <SelectContent>
        <SelectItem value={NONE}>Platform default</SelectItem>
        {profiles
          .filter((profile) => !profile.isDefault)
          .map((profile) => (
            <SelectItem key={profile.id} value={profile.id}>
              {profile.name}
            </SelectItem>
          ))}
      </SelectContent>
    </Select>
  );

  return (
    <div className="space-y-6">
      <section className="space-y-3">
        <div className="flex items-center justify-between gap-3">
          <h2 className="text-sm font-semibold">Profiles</h2>
          <Button type="button" size="sm" onClick={openCreate}>
            <Plus className="size-4" aria-hidden />
            New profile
          </Button>
        </div>
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
          {profiles.map((profile) => (
            <ProfileCard
              key={profile.id}
              profile={profile}
              onEdit={() => openEdit(profile)}
              onDelete={() => setDeleteTarget(profile)}
              deleting={action.isPending}
            />
          ))}
        </div>
      </section>

      <section className="space-y-3">
        <h2 className="text-sm font-semibold">Plans</h2>
        <Card padding="sm" className="divide-border/60 divide-y">
          {data.plans.map((plan) => (
            <div
              key={plan.id}
              className="flex flex-col gap-2 py-2 first:pt-0 last:pb-0 sm:flex-row sm:items-center sm:justify-between"
            >
              <span className="text-sm font-medium">{plan.name}</span>
              {profileSelect(
                plan.profileId,
                (value) => bindPlan(plan.id, value),
                `${plan.name} profile`
              )}
            </div>
          ))}
        </Card>
      </section>

      {data.developments.length > 0 ? (
        <section className="space-y-3">
          <h2 className="text-sm font-semibold">Developments</h2>
          <Card padding="sm" className="divide-border/60 divide-y">
            {data.developments.map((development) => (
              <div
                key={development.id}
                className="flex flex-col gap-2 py-2 first:pt-0 last:pb-0 sm:flex-row sm:items-center sm:justify-between"
              >
                <div className="min-w-0">
                  <p className="truncate text-sm font-medium">{development.name}</p>
                  <p className="text-muted-foreground text-xs">
                    {development.propertyCount} properties
                  </p>
                </div>
                {profileSelect(
                  development.profileId,
                  (value) => assignDevelopment(development.id, value),
                  `${development.name} profile`
                )}
              </div>
            ))}
          </Card>
        </section>
      ) : null}

      <AiProfileDialog open={dialogOpen} onOpenChange={setDialogOpen} profile={editing} />

      <AlertDialog
        open={Boolean(deleteTarget)}
        onOpenChange={(open) => !open && setDeleteTarget(null)}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete {deleteTarget?.name}?</AlertDialogTitle>
            <AlertDialogDescription>This cannot be undone.</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={confirmDelete}>Delete</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
