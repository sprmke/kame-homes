import { Link } from 'react-router-dom';

import { Copy, ExternalLink, Pencil } from 'lucide-react';
import { toast } from 'sonner';

import { withGuestEmbedPreviewUrl } from '@/features/guest/lib/guestEmbedPreview';
import { absoluteGuestPath } from '@/features/guest/lib/guestPublicPaths';

import { PublicPageLivePreview } from '@/features/dashboard/custom-pages/components/PublicPageLivePreview';
import { useOrgContext } from '@/features/dashboard/org/components/RequireOrgContext';
import { propertySectionPath } from '@/features/dashboard/org/lib/tenantPaths';
import type { PropertyGuestPublicPage } from '@/features/dashboard/property/lib/propertyGuestPublicPages';

import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

type Props = {
  page: PropertyGuestPublicPage;
  propertyName: string;
  coverUrl: string | null;
  variant?: 'editable' | 'static';
  /** When false, hide the Edit control (view-only Public Pages grant). */
  canEdit?: boolean;
  /** When true, Edit opens upgrade instead of the editor. */
  locked?: boolean;
  onUnlock?: () => void;
};

async function copyPublicPageLink(href: string, label: string) {
  try {
    await navigator.clipboard.writeText(href);
    toast.success(`${label} link copied`);
  } catch {
    toast.error('Could not copy link');
  }
}

export function PublicPageCard({
  page,
  propertyName,
  coverUrl,
  variant: variantProp,
  canEdit = true,
  locked = false,
  onUnlock,
}: Props) {
  const { orgSlug, propertySlug } = useOrgContext();
  const Icon = page.icon;
  const href = absoluteGuestPath(page.path);
  const copyHref = absoluteGuestPath(page.copyPath ?? page.path);
  const openHref = page.openUsesEmbed ? withGuestEmbedPreviewUrl(href) : href;
  const previewSrc = withGuestEmbedPreviewUrl(href);
  const variant = variantProp ?? (page.editable ? 'editable' : 'static');
  const editHref =
    variant === 'editable' && canEdit && !locked
      ? `${propertySectionPath(orgSlug, propertySlug, 'public-pages')}/${page.id}/edit`
      : null;

  return (
    <article
      className={cn(
        'surface-card-interactive native-press group relative flex h-full min-h-[44px] flex-col overflow-hidden',
        variant === 'editable' && 'ring-border/60 sm:shadow-sm'
      )}
    >
      <a
        href={openHref}
        target="_blank"
        rel="noopener noreferrer"
        className="relative block aspect-[16/10] w-full overflow-hidden sm:aspect-[16/9]"
        aria-label={`Open ${page.label} in a new tab`}
      >
        <PublicPageLivePreview
          src={previewSrc}
          pageId={page.id}
          label={page.label}
          propertyName={propertyName}
          coverUrl={coverUrl}
        />
      </a>

      <div
        className={cn(
          'flex flex-1 flex-col gap-2.5 px-3.5 py-3 sm:py-3.5',
          variant === 'editable' && 'sm:gap-3 sm:px-4 sm:py-4'
        )}
      >
        <div className="flex items-start gap-2.5">
          <span
            className={cn(
              'bg-primary/10 text-primary mt-0.5 flex shrink-0 items-center justify-center rounded-lg',
              variant === 'editable' ? 'size-9' : 'size-8'
            )}
          >
            <Icon className="size-4" aria-hidden />
          </span>
          <div className="min-w-0 flex-1">
            <span
              className={cn(
                'text-foreground block truncate font-semibold',
                variant === 'editable' ? 'text-base' : 'text-sm'
              )}
            >
              {page.label}
            </span>
            <p className="text-muted-foreground mt-0.5 line-clamp-2 min-h-[2.5rem] text-xs leading-relaxed">
              {page.description}
            </p>
          </div>
        </div>

        {variant === 'editable' ? (
          <div className="mt-auto flex gap-2">
            {editHref ? (
              <Button
                type="button"
                variant="outline-primary"
                size="sm"
                className="h-9 min-h-[44px] flex-1 gap-1.5"
                asChild
              >
                <Link to={editHref}>
                  <Pencil className="size-3.5" aria-hidden />
                  Edit
                </Link>
              </Button>
            ) : locked && canEdit ? (
              <Button
                type="button"
                variant="outline-primary"
                size="sm"
                className="h-9 min-h-[44px] flex-1 gap-1.5"
                onClick={onUnlock}
              >
                Upgrade
              </Button>
            ) : null}
            <Button
              type="button"
              variant="outline"
              size="icon"
              className="size-11 shrink-0"
              aria-label={`Copy ${page.label} link`}
              onClick={() => void copyPublicPageLink(copyHref, page.label)}
            >
              <Copy className="size-3.5" aria-hidden />
            </Button>
            <Button
              type="button"
              variant="outline"
              size="icon"
              className="size-11 shrink-0"
              asChild
            >
              <a
                href={openHref}
                target="_blank"
                rel="noopener noreferrer"
                aria-label={`Open ${page.label}`}
              >
                <ExternalLink className="size-3.5" aria-hidden />
              </a>
            </Button>
          </div>
        ) : (
          <div className="mt-auto flex gap-2">
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="h-9 min-h-[44px] flex-1 gap-1.5"
              onClick={() => void copyPublicPageLink(copyHref, page.label)}
            >
              <Copy className="size-3.5" aria-hidden />
              Copy link
            </Button>
            <Button
              type="button"
              variant="outline-primary"
              size="sm"
              className="h-9 min-h-[44px] flex-1 gap-1.5"
              asChild
            >
              <a href={openHref} target="_blank" rel="noopener noreferrer">
                <ExternalLink className="size-3.5" aria-hidden />
                Open page
              </a>
            </Button>
          </div>
        )}
      </div>
    </article>
  );
}
