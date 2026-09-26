import { useMemo, useState } from 'react';

import { useSearchParams } from 'react-router-dom';

import { BookOpen, Pencil, Plus, Trash2 } from 'lucide-react';
import { toast } from 'sonner';

import {
  AdminListPagination,
  AdminListPerPageSelect,
} from '@/features/dashboard/bookings/components/AdminListToolbar';
import { AdminPageHeader } from '@/features/dashboard/bookings/components/AdminPageHeader';
import { SuperAdminEmptyState } from '@/features/dashboard/super-admin/components/shared/SuperAdminEmptyState';
import { SuperAdminAdminListBodySkeleton } from '@/components/skeletons/SuperAdminSkeletons';
import { SuperAdminPlaybookArticleEditorDialog } from '@/features/dashboard/super-admin/components/super-admin-support/SuperAdminPlaybookArticleEditorDialog';
import {
  useDeletePlaybookArticle,
  useHostPlaybookArticlesAdmin,
  useUpdatePlaybookArticle,
  type AdminPlaybookArticle,
} from '@/features/dashboard/super-admin/hooks/useHostPlaybookArticlesAdmin';

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
import { Button } from '@/components/ui/button';
import { Switch } from '@/components/ui/switch';
import { friendlyToastError } from '@/lib/feedback/toastMessages';
import {
  ADMIN_DEFAULT_PAGE_SIZE,
  buildPageItems,
  normalizeAdminPageLimit,
} from '@/lib/table/pagination';
import { cn } from '@/lib/utils';

function ArticleRow({
  article,
  onEdit,
  onDeleteRequest,
}: {
  article: AdminPlaybookArticle;
  onEdit: () => void;
  onDeleteRequest: () => void;
}) {
  const updateArticle = useUpdatePlaybookArticle();

  return (
    <div
      className={cn(
        'border-border bg-card flex flex-col gap-2 rounded-xl border p-4 sm:flex-row sm:items-start sm:justify-between sm:gap-4',
        !article.is_active && 'opacity-60'
      )}
    >
      <div className="min-w-0 flex-1">
        <p className="text-foreground text-sm font-medium">{article.title}</p>
        <p className="text-muted-foreground mt-1 font-mono text-xs">{article.slug}</p>
        <p className="text-muted-foreground mt-1 line-clamp-2 text-sm leading-relaxed">
          {article.body_md}
        </p>
      </div>

      <div className="flex shrink-0 items-center gap-1">
        <Switch
          checked={article.is_active}
          onCheckedChange={(checked) =>
            updateArticle.mutate(
              { id: article.id, isActive: checked },
              {
                onError: (error) =>
                  toast.error(friendlyToastError(error, 'Could not update article')),
              }
            )
          }
          aria-label={article.is_active ? 'Active' : 'Inactive'}
        />
        <Button
          type="button"
          variant="ghost"
          size="icon"
          aria-label="Edit article"
          onClick={onEdit}
          className="size-9"
        >
          <Pencil className="size-4" aria-hidden />
        </Button>
        <Button
          type="button"
          variant="ghost"
          size="icon"
          aria-label="Delete article"
          onClick={onDeleteRequest}
          className="text-destructive size-9"
        >
          <Trash2 className="size-4" aria-hidden />
        </Button>
      </div>
    </div>
  );
}

export function SuperAdminPlaybookArticlesPage() {
  const [searchParams, setSearchParams] = useSearchParams();
  const page = Number(searchParams.get('page') ?? '1');
  const limit = normalizeAdminPageLimit(
    Number(searchParams.get('limit') ?? String(ADMIN_DEFAULT_PAGE_SIZE))
  );
  const { data, isLoading, error } = useHostPlaybookArticlesAdmin({ page, limit });
  const deleteArticle = useDeletePlaybookArticle();

  const [editingArticle, setEditingArticle] = useState<AdminPlaybookArticle | 'new' | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<AdminPlaybookArticle | null>(null);

  const articles = useMemo(() => data?.articles ?? [], [data]);
  const total = data?.total ?? 0;
  const pageCount = Math.max(1, Math.ceil(total / limit));
  const pageItems = buildPageItems(page, pageCount);

  const setPage = (nextPage: number) =>
    setSearchParams(
      (prev) => {
        const sp = new URLSearchParams(prev);
        if (nextPage === 1) sp.delete('page');
        else sp.set('page', String(nextPage));
        return sp;
      },
      { replace: true }
    );

  const setLimit = (nextLimit: number) =>
    setSearchParams(
      (prev) => {
        const sp = new URLSearchParams(prev);
        if (nextLimit === ADMIN_DEFAULT_PAGE_SIZE) sp.delete('limit');
        else sp.set('limit', String(nextLimit));
        sp.delete('page');
        return sp;
      },
      { replace: true }
    );

  const categories = useMemo(
    () => Array.from(new Set(articles.map((a) => a.category))),
    [articles]
  );

  const groupedByCategory = useMemo(() => {
    const byCategory = new Map<string, AdminPlaybookArticle[]>();
    for (const article of articles) {
      const list = byCategory.get(article.category) ?? [];
      list.push(article);
      byCategory.set(article.category, list);
    }
    return Array.from(byCategory.entries());
  }, [articles]);

  const handleDelete = async () => {
    if (!deleteTarget) return;
    try {
      await deleteArticle.mutateAsync(deleteTarget.id);
      toast.success('Article deleted');
      setDeleteTarget(null);
    } catch (error) {
      toast.error(friendlyToastError(error, 'Could not delete article'));
    }
  };

  return (
    <div className="space-y-3 sm:space-y-4">
      <AdminPageHeader
        title="Improvement Playbook"
        subtitle="Curated tips matched against a property's Analytics numbers and linked from the AI Performance Review."
        actions={
          <Button type="button" onClick={() => setEditingArticle('new')} className="min-h-[44px]">
            <Plus className="size-4" aria-hidden />
            Add article
          </Button>
        }
      />

      {isLoading ? (
        <SuperAdminAdminListBodySkeleton metricCount={4} />
      ) : error ? (
        <p className="text-destructive text-sm">Could not load Playbook articles.</p>
      ) : (
        <>
          <div className="flex justify-end">
            <AdminListPerPageSelect limit={limit} onChange={setLimit} />
          </div>

          {groupedByCategory.length === 0 ? (
            <SuperAdminEmptyState icon={BookOpen} title="No Playbook articles yet" />
          ) : (
            groupedByCategory.map(([category, items]) => (
              <div key={category} className="space-y-2">
                <p className="text-muted-foreground text-xs font-bold uppercase tracking-wider">
                  {category}
                </p>
                <div className="space-y-2">
                  {items.map((article) => (
                    <ArticleRow
                      key={article.id}
                      article={article}
                      onEdit={() => setEditingArticle(article)}
                      onDeleteRequest={() => setDeleteTarget(article)}
                    />
                  ))}
                </div>
              </div>
            ))
          )}

          {pageCount > 1 ? (
            <AdminListPagination
              ariaLabel="Playbook articles pagination"
              page={page}
              pageCount={pageCount}
              pageItems={pageItems}
              isLoading={isLoading}
              onPageChange={setPage}
            />
          ) : null}
        </>
      )}

      <SuperAdminPlaybookArticleEditorDialog
        article={editingArticle}
        categories={categories}
        onOpenChange={(open) => {
          if (!open) setEditingArticle(null);
        }}
      />

      <AlertDialog
        open={Boolean(deleteTarget)}
        onOpenChange={(open) => !open && setDeleteTarget(null)}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete this article?</AlertDialogTitle>
            <AlertDialogDescription>
              This removes it from the Improvement Playbook and any AI review links that cite it
              stop resolving. This can&apos;t be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={() => void handleDelete()}>Delete</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
