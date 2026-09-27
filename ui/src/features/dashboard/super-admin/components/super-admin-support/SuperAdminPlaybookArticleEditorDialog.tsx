import { useEffect, useState } from 'react';

import { Loader2 } from 'lucide-react';
import { toast } from 'sonner';

import type { AdminPlaybookArticle } from '@/features/dashboard/super-admin/hooks/useHostPlaybookArticlesAdmin';
import {
  useCreatePlaybookArticle,
  useUpdatePlaybookArticle,
} from '@/features/dashboard/super-admin/hooks/useHostPlaybookArticlesAdmin';

import { AdminDialogShell } from '@/components/AdminDialogShell';
import { UnsavedChangesDialog } from '@/components/forms/UnsavedChangesDialog';
import { Button } from '@/components/ui/button';
import { Combobox } from '@/components/ui/combobox';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { useGuardedClose } from '@/hooks/useGuardedClose';
import { friendlyToastError } from '@/lib/feedback/toastMessages';

type Props = {
  article: AdminPlaybookArticle | 'new' | null;
  categories: string[];
  onOpenChange: (open: boolean) => void;
};

const DEFAULT_APPLIES_WHEN = '{}';

export function SuperAdminPlaybookArticleEditorDialog({
  article,
  categories,
  onOpenChange,
}: Props) {
  const isNew = article === 'new';
  const editing = article && article !== 'new' ? article : null;

  const [slug, setSlug] = useState('');
  const [category, setCategory] = useState('');
  const [title, setTitle] = useState('');
  const [bodyMd, setBodyMd] = useState('');
  const [appliesWhen, setAppliesWhen] = useState(DEFAULT_APPLIES_WHEN);
  const [sortOrder, setSortOrder] = useState(0);

  const createArticle = useCreatePlaybookArticle();
  const updateArticle = useUpdatePlaybookArticle();
  const isPending = createArticle.isPending || updateArticle.isPending;

  useEffect(() => {
    setSlug(editing?.slug ?? '');
    setCategory(editing?.category ?? categories[0] ?? '');
    setTitle(editing?.title ?? '');
    setBodyMd(editing?.body_md ?? '');
    setAppliesWhen(
      editing?.applies_when ? JSON.stringify(editing.applies_when, null, 2) : DEFAULT_APPLIES_WHEN
    );
    setSortOrder(editing?.sort_order ?? 0);
  }, [editing, categories]);

  const handleSave = async (): Promise<boolean> => {
    if ((isNew && !slug.trim()) || !category.trim() || !title.trim() || !bodyMd.trim()) {
      toast.error(
        isNew
          ? 'Slug, category, title, and body are required'
          : 'Category, title, and body are required'
      );
      return false;
    }

    let parsedAppliesWhen: Record<string, unknown>;
    try {
      const parsed: unknown = JSON.parse(appliesWhen.trim() || '{}');
      if (typeof parsed !== 'object' || parsed === null || Array.isArray(parsed)) {
        throw new Error('not an object');
      }
      parsedAppliesWhen = parsed as Record<string, unknown>;
    } catch {
      toast.error(
        '"Applies when" must be valid JSON, e.g. {"metric":"forwardOccupancyState","op":"eq","value":"underbooked"}'
      );
      return false;
    }

    try {
      if (isNew) {
        await createArticle.mutateAsync({
          slug: slug.trim().toLowerCase(),
          category: category.trim(),
          title: title.trim(),
          bodyMd: bodyMd.trim(),
          appliesWhen: parsedAppliesWhen,
          sortOrder,
        });
        toast.success('Article added');
      } else if (editing) {
        await updateArticle.mutateAsync({
          id: editing.id,
          category: category.trim(),
          title: title.trim(),
          bodyMd: bodyMd.trim(),
          appliesWhen: parsedAppliesWhen,
          sortOrder,
        });
        toast.success('Article updated');
      }
      onOpenChange(false);
      return true;
    } catch (error) {
      toast.error(friendlyToastError(error, 'Could not save article'));
      return false;
    }
  };

  const baselineKey = JSON.stringify([
    editing?.slug ?? '',
    editing?.category ?? categories[0] ?? '',
    editing?.title ?? '',
    editing?.body_md ?? '',
    editing?.applies_when ? JSON.stringify(editing.applies_when, null, 2) : DEFAULT_APPLIES_WHEN,
    editing?.sort_order ?? 0,
  ]);
  const isDirty =
    Boolean(article) &&
    JSON.stringify([slug, category, title, bodyMd, appliesWhen, sortOrder]) !== baselineKey;
  const { onOpenChange: guardedOpenChange, dialogProps } = useGuardedClose({
    open: Boolean(article),
    onOpenChange,
    isDirty,
    onSave: handleSave,
    onDiscard: () => {
      const [s0, c0, t0, b0, a0, o0] = JSON.parse(baselineKey) as [
        string,
        string,
        string,
        string,
        string,
        number,
      ];
      setSlug(s0);
      setCategory(c0);
      setTitle(t0);
      setBodyMd(b0);
      setAppliesWhen(a0);
      setSortOrder(o0);
    },
  });

  return (
    <>
      <AdminDialogShell
        open={Boolean(article)}
        onOpenChange={guardedOpenChange}
        title={isNew ? 'Add Playbook article' : 'Edit Playbook article'}
        sizeClassName="max-w-[min(calc(100vw-1.5rem),36rem)] sm:max-w-xl"
        footer={
          <Button
            type="button"
            onClick={() => void handleSave()}
            disabled={isPending}
            className="min-h-[44px] w-full sm:w-auto"
          >
            {isPending ? <Loader2 className="size-4 animate-spin" aria-hidden /> : null}
            Save
          </Button>
        }
      >
        <div className="space-y-3">
          {isNew ? (
            <div className="space-y-1.5">
              <Label htmlFor="playbook-slug">Slug</Label>
              <Input
                id="playbook-slug"
                value={slug}
                onChange={(event) => setSlug(event.target.value)}
                placeholder="e.g. raise-rates-when-fully-booked"
                maxLength={80}
              />
              <p className="text-muted-foreground text-xs">
                Lowercase letters, digits, hyphens only. Cannot be changed after creation.
              </p>
            </div>
          ) : null}

          <div className="space-y-1.5">
            <Label htmlFor="playbook-category">Category</Label>
            <Combobox
              id="playbook-category"
              value={category}
              onChange={setCategory}
              options={categories}
              creatable
              maxLength={80}
              placeholder="Select or create a category"
              searchPlaceholder="Search categories…"
              emptyText="Type to create a new category."
            />
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="playbook-title">Title</Label>
            <Input
              id="playbook-title"
              value={title}
              onChange={(event) => setTitle(event.target.value)}
              maxLength={200}
            />
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="playbook-body">Body (markdown)</Label>
            <Textarea
              id="playbook-body"
              value={bodyMd}
              onChange={(event) => setBodyMd(event.target.value)}
              rows={6}
              maxLength={4000}
            />
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="playbook-applies-when">Applies when (JSON condition)</Label>
            <Textarea
              id="playbook-applies-when"
              value={appliesWhen}
              onChange={(event) => setAppliesWhen(event.target.value)}
              rows={3}
              className="font-mono text-xs"
            />
            <p className="text-muted-foreground text-xs">
              Matched against the property&apos;s analytics bundle, e.g.{' '}
              <code>{'{"metric":"forwardOccupancyState","op":"eq","value":"underbooked"}'}</code>.
              Leave as <code>{'{}'}</code> to always match.
            </p>
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="playbook-sort-order">Sort order</Label>
            <Input
              id="playbook-sort-order"
              type="number"
              value={sortOrder}
              onChange={(event) => setSortOrder(Number(event.target.value) || 0)}
              className="w-32"
            />
            <p className="text-muted-foreground text-xs">Lower numbers are matched/shown first.</p>
          </div>
        </div>
      </AdminDialogShell>
      <UnsavedChangesDialog {...dialogProps} />
    </>
  );
}
