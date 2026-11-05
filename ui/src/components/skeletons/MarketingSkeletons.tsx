import { mobileFloatingDockClassName } from '@/components/mobile/BottomTabBar';
import { Skeleton } from '@/components/ui/skeleton';
import { useIsBelowLg } from '@/hooks/useMediaQuery';
import { cn } from '@/lib/utils';

/** Same grid as `MarketingLibraryHome` / `AiStudioHome`. */
const LIBRARY_GRID =
  'grid grid-cols-2 gap-x-3 gap-y-4 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-4 xl:grid-cols-5 2xl:grid-cols-6';

/** Same grid as `MarketingTemplateBrowser`. */
const TEMPLATE_GRID = 'grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4 xl:grid-cols-5';

function MarketingTileSkeleton({ index = 0 }: { index?: number }) {
  return (
    <li className="min-w-0" style={{ opacity: 1 - Math.min(index, 6) * 0.04 }}>
      <div className="flex min-w-0 flex-col gap-1.5">
        <Skeleton className="aspect-[4/5] w-full rounded-xl" />
        <div className="min-w-0 px-0.5">
          <Skeleton className="h-4 w-3/4" />
          <Skeleton className="mt-1 h-3.5 w-1/2" />
        </div>
      </div>
    </li>
  );
}

/** Tiles for the Library / AI Studio saved grids. */
export function MarketingLibraryGridSkeleton({
  count = 12,
  label = 'Loading',
}: {
  count?: number;
  label?: string;
}) {
  return (
    <ul className={LIBRARY_GRID} aria-busy="true" aria-label={label}>
      {Array.from({ length: count }).map((_, index) => (
        <MarketingTileSkeleton key={index} index={index} />
      ))}
    </ul>
  );
}

/** `MarketingNewButton`: split New + Create with AI. */
function MarketingCreateActionsSkeleton({ withAi = true }: { withAi?: boolean }) {
  return (
    <div className="flex flex-wrap items-center gap-2">
      <div className="flex">
        <Skeleton className="h-11 w-28 rounded-lg rounded-r-none lg:h-10" />
        <Skeleton className="h-11 w-9 rounded-lg rounded-l-none border-l lg:h-10" />
      </div>
      {withAi ? <Skeleton className="h-11 w-32 rounded-lg lg:h-10" /> : null}
    </div>
  );
}

/** `MarketingLibraryToolbar`: heading/create actions, search, filters, history. */
function MarketingLibraryToolbarSkeleton({
  title,
  withStartActions = true,
}: {
  title?: string;
  withStartActions?: boolean;
}) {
  const isBelowLg = useIsBelowLg();

  if (isBelowLg) {
    return (
      <div className="space-y-2.5">
        <div className="flex items-center gap-1">
          <div className="min-w-0 flex-1">
            {withStartActions ? (
              <MarketingCreateActionsSkeleton />
            ) : title ? (
              <h2 className="text-section-title truncate">{title}</h2>
            ) : (
              <Skeleton className="h-5 w-40" />
            )}
          </div>
          <Skeleton className="size-11 shrink-0 rounded-lg" />
        </div>
        <div className="flex items-center gap-2">
          <Skeleton className="h-10 min-w-0 flex-1 rounded-lg" />
          <Skeleton className="size-11 shrink-0 rounded-xl" />
        </div>
      </div>
    );
  }

  return (
    <div className="flex items-center gap-2">
      <div className="mr-auto min-w-0">
        {withStartActions ? (
          <MarketingCreateActionsSkeleton />
        ) : title ? (
          <h2 className="text-section-title truncate">{title}</h2>
        ) : (
          <Skeleton className="h-5 w-40" />
        )}
      </div>
      <Skeleton className="h-10 w-60 shrink-0 rounded-lg" />
      <Skeleton className="h-10 w-24 shrink-0 rounded-lg" />
      <Skeleton className="size-10 shrink-0 rounded-lg" />
    </div>
  );
}

/**
 * Library body (Posts / Videos / Calendar): toolbar + saved-design tile grid. This is
 * the default first-load state for a tab.
 */
export function MarketingLibraryBodySkeleton({ title }: { title?: string } = {}) {
  return (
    <div
      role="status"
      className="flex min-h-0 flex-1 flex-col overflow-y-auto"
      aria-busy="true"
      aria-label="Loading marketing"
    >
      <div className="mx-auto w-full max-w-[100rem] space-y-4 p-3 sm:p-4 lg:p-6">
        <MarketingLibraryToolbarSkeleton title={title} />
        <MarketingLibraryGridSkeleton />
      </div>
    </div>
  );
}

function TemplateGroupSkeleton({ tiles = 5 }: { tiles?: number }) {
  return (
    <section className="space-y-3" aria-hidden>
      <Skeleton className="h-4 w-32" />
      <ul className={TEMPLATE_GRID}>
        {Array.from({ length: tiles }).map((_, index) => (
          <MarketingTileSkeleton key={index} index={index} />
        ))}
      </ul>
    </section>
  );
}

/**
 * First-visit template browser ("Make your first post"): create row + search/size,
 * intro heading, Blank/Collage start tiles, then template category groups.
 */
export function MarketingTemplateBrowserSkeleton() {
  return (
    <div
      role="status"
      className="flex min-h-0 flex-1 flex-col overflow-y-auto"
      aria-busy="true"
      aria-label="Loading templates"
    >
      <div className="mx-auto w-full max-w-[100rem] p-3 sm:p-4 lg:p-6">
        <div className="flex flex-col gap-4">
          <div className="flex flex-col gap-2 lg:flex-row lg:items-center">
            <div className="min-w-0 lg:mr-auto">
              <MarketingCreateActionsSkeleton />
            </div>
            <div className="flex min-w-0 items-center gap-2">
              <Skeleton className="h-10 min-w-0 flex-1 rounded-lg lg:w-60 lg:flex-none" />
              <Skeleton className="h-10 w-28 shrink-0 rounded-lg" />
            </div>
          </div>

          <Skeleton className="h-5 w-56 max-w-full" />

          <ul className={TEMPLATE_GRID} aria-hidden>
            {Array.from({ length: 2 }).map((_, index) => (
              <MarketingTileSkeleton key={index} index={index} />
            ))}
          </ul>

          <TemplateGroupSkeleton tiles={5} />
          <TemplateGroupSkeleton tiles={5} />
        </div>
      </div>
    </div>
  );
}

/** One AI Studio example card: 4:5 art + title/meta footer. */
function AiSampleCardSkeleton({ index = 0 }: { index?: number }) {
  return (
    <li
      className="w-[44vw] shrink-0 snap-start sm:w-48 lg:w-52"
      style={{ opacity: 1 - Math.min(index, 4) * 0.05 }}
    >
      <div className="border-border bg-card flex w-full flex-col overflow-hidden rounded-xl border">
        <Skeleton className="aspect-[4/5] w-full rounded-none" />
        <div className="min-w-0 px-3 py-2.5">
          <Skeleton className="h-4 w-2/3" />
          <Skeleton className="mt-1 h-4 w-1/2" />
        </div>
      </div>
    </li>
  );
}

/**
 * AI Studio home: create buttons, horizontal example row, library toolbar, then the
 * saved-creation tile grid.
 */
export function MarketingAiStudioHomeSkeleton() {
  return (
    <div
      role="status"
      className="flex min-h-0 flex-1 flex-col overflow-y-auto"
      aria-busy="true"
      aria-label="Loading AI Studio"
    >
      <div className="mx-auto w-full max-w-[100rem] space-y-4 p-3 sm:p-4 lg:p-6">
        <div className="flex flex-wrap items-center gap-2" aria-hidden>
          {['New post', 'New photo', 'New clip'].map((label, index) => (
            <span
              key={label}
              className={cn(
                'inline-flex h-11 items-center rounded-lg px-3 text-sm font-semibold lg:h-10',
                index === 0
                  ? 'bg-primary-strong text-primary-foreground'
                  : 'border-border text-foreground border'
              )}
            >
              {label}
            </span>
          ))}
        </div>

        <section className="min-w-0 space-y-2.5" aria-hidden>
          <div className="flex min-h-9 flex-wrap items-center gap-x-3 gap-y-2">
            <h3 className="text-section-title mr-auto">Start from an example</h3>
            <Skeleton className="h-8 w-40 rounded-lg" />
            <span className="text-muted-foreground inline-flex h-11 items-center px-3 text-sm font-medium">
              See all
            </span>
          </div>
          <ul className="-mx-3 flex gap-3 overflow-hidden px-3 pb-1 sm:-mx-4 sm:px-4 lg:mx-0 lg:px-0">
            {Array.from({ length: 5 }).map((_, index) => (
              <AiSampleCardSkeleton key={index} index={index} />
            ))}
          </ul>
        </section>

        <MarketingLibraryToolbarSkeleton title="Your creations" withStartActions={false} />
        <MarketingLibraryGridSkeleton count={12} label="Loading your creations" />
      </div>
    </div>
  );
}

/** Shared marketing editor top bar (`MarketingEditorTopBar`). */
function MarketingEditorTopBarSkeleton({ backLabel }: { backLabel?: string }) {
  return (
    <div className="border-border bg-card shrink-0 border-b" aria-hidden>
      <div className="flex min-h-[52px] items-center gap-1 px-1.5 py-1 sm:gap-2 sm:px-3">
        <span className="text-muted-foreground inline-flex h-11 min-w-16 shrink-0 items-center justify-center gap-1 px-2 text-sm font-medium">
          ‹ {backLabel ?? ''}
        </span>
        <Skeleton className="hidden h-5 w-px shrink-0 sm:block" />
        <Skeleton className="h-5 w-40 max-w-[min(22rem,45vw)]" />
        <Skeleton className="h-4 w-16 shrink-0" />
        <div className="ml-auto hidden shrink-0 items-center gap-2 lg:flex">
          <Skeleton className="h-9 w-24 rounded-md" />
          <Skeleton className="h-9 w-20 rounded-md" />
          <Skeleton className="h-9 w-24 rounded-md" />
        </div>
      </div>
    </div>
  );
}

/** 72px icon rail used by all three editors (`MarketingEditorRail`). */
function MarketingEditorRailSkeleton({
  labels = ['Templates', 'Text', 'Photos', 'Elements', 'Uploads'],
}: {
  labels?: string[];
}) {
  return (
    <nav
      className="border-border bg-card hidden w-[72px] shrink-0 flex-col gap-0.5 overflow-y-auto border-r py-2 lg:flex"
      aria-hidden
    >
      {labels.map((label, index) => (
        <div
          key={label}
          className="mx-1 flex min-h-[60px] flex-col items-center justify-center gap-1 rounded-lg px-1 text-[11px] leading-tight"
          style={{ opacity: 1 - index * 0.05 }}
        >
          <Skeleton className="size-5 rounded" />
          <span className="text-muted-foreground text-center">{label}</span>
        </div>
      ))}
    </nav>
  );
}

/** Left slide-out panel beside the rail (video default = Media). */
function MarketingEditorRailPanelSkeleton({ rows = 5 }: { rows?: number }) {
  return (
    <aside
      className="border-border bg-card hidden w-[19rem] shrink-0 flex-col border-r xl:w-80 2xl:flex"
      aria-hidden
    >
      <div className="border-border flex min-h-[52px] shrink-0 items-center gap-2 border-b px-4 py-2">
        <Skeleton className="h-4 w-24" />
        <Skeleton className="ml-auto size-8 rounded-md" />
      </div>
      <div className="space-y-3 p-4">
        <Skeleton className="h-10 w-full rounded-lg" />
        <div className="grid grid-cols-2 gap-2">
          {Array.from({ length: rows * 2 }).map((_, index) => (
            <Skeleton key={index} className="aspect-square w-full rounded-lg" />
          ))}
        </div>
      </div>
    </aside>
  );
}

/** Right inspector (`MarketingEditorInspector`) — open by default in the video editor. */
function MarketingEditorInspectorSkeleton({ rows = 4 }: { rows?: number }) {
  return (
    <aside
      className="border-border bg-card hidden w-[19rem] shrink-0 flex-col border-l lg:flex xl:w-80"
      aria-hidden
    >
      <div className="border-border flex min-h-[52px] shrink-0 items-center gap-2 border-b px-4 py-2">
        <Skeleton className="h-4 w-20" />
        <Skeleton className="ml-auto size-8 rounded-md" />
      </div>
      <div className="space-y-4 p-4">
        {Array.from({ length: rows }).map((_, index) => (
          <div key={index} className="space-y-2">
            <Skeleton className="h-3 w-24" />
            <Skeleton className="h-10 w-full rounded-lg" />
          </div>
        ))}
      </div>
    </aside>
  );
}

/** Floating editor dock above the app tab bar (mobile only). */
function MarketingEditorMobileDockSkeleton({
  labels = ['Templates', 'AI'],
}: {
  labels?: string[];
}) {
  return (
    <div
      className="pointer-events-none fixed inset-x-0 z-40 px-4 lg:hidden"
      style={{ bottom: 'calc(4.75rem + env(safe-area-inset-bottom, 0px))' }}
      aria-hidden
    >
      <div className={cn(mobileFloatingDockClassName, 'px-3 py-2.5')}>
        <div className="flex items-center gap-1">
          {labels.map((label) => (
            <div
              key={label}
              className="flex h-11 min-w-0 flex-1 flex-col items-center justify-center gap-0.5 rounded-lg px-1 text-[10px] font-medium leading-tight"
            >
              <Skeleton className="size-[18px] rounded" />
              <span className="text-muted-foreground max-w-full truncate">{label}</span>
            </div>
          ))}
          <Skeleton className="size-11 shrink-0 rounded-lg" />
        </div>
      </div>
    </div>
  );
}

function DesignEditorBodySkeleton() {
  return (
    <div className="flex min-h-0 flex-1 overflow-hidden" aria-hidden>
      <div className="border-border bg-card hidden w-[72px] shrink-0 flex-col gap-0.5 border-r py-2 lg:flex">
        {['Templates', 'Text', 'Photos', 'Elements', 'Uploads'].map((label, index) => (
          <div
            key={label}
            className="mx-1 flex min-h-[60px] flex-col items-center justify-center gap-1 px-1 text-[11px] leading-tight"
            style={{ opacity: 1 - index * 0.05 }}
          >
            <Skeleton className="size-5 rounded" />
            <span className="text-muted-foreground text-center">{label}</span>
          </div>
        ))}
      </div>
      <div className="border-border bg-card hidden w-[350px] shrink-0 flex-col border-r lg:flex">
        <div className="border-border flex min-h-[52px] items-center gap-2 border-b px-4 py-2">
          <Skeleton className="h-4 w-24" />
          <Skeleton className="ml-auto size-8 rounded-md" />
        </div>
        <div className="grid grid-cols-2 gap-2 p-3">
          {Array.from({ length: 8 }).map((_, index) => (
            <Skeleton key={index} className="aspect-square w-full rounded-lg" />
          ))}
        </div>
      </div>
      <div className="bg-muted/30 flex min-h-0 min-w-0 flex-1 items-center justify-center overflow-hidden p-4 sm:p-6">
        <Skeleton className="aspect-square h-auto max-h-full w-full max-w-[min(100%,42rem)] rounded-xl" />
      </div>
    </div>
  );
}

function VideoEditorBodySkeleton() {
  return (
    <div className="flex min-h-0 flex-1 overflow-hidden" aria-hidden>
      <MarketingEditorRailSkeleton labels={['Media', 'Text', 'Edit', 'Templates', 'AI']} />
      <MarketingEditorRailPanelSkeleton rows={4} />
      <div className="flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden">
        <div className="flex items-center justify-between gap-2 px-3 py-2 sm:px-4">
          <Skeleton className="h-4 w-24" />
          <div className="flex items-center gap-2">
            <Skeleton className="h-9 w-32 rounded-lg" />
            <Skeleton className="h-9 w-20 rounded-lg" />
          </div>
        </div>
        <div className="bg-muted/30 flex min-h-0 flex-1 items-center justify-center overflow-hidden p-4">
          <Skeleton className="aspect-video max-h-full w-full max-w-[min(100%,48rem)] rounded-xl" />
        </div>
        <div className="border-border shrink-0 space-y-2 border-t p-3">
          <div className="flex items-center gap-2">
            <Skeleton className="h-4 w-20" />
            <Skeleton className="ml-auto h-8 w-24 rounded-lg" />
          </div>
          <div className="flex gap-2 overflow-hidden">
            {Array.from({ length: 7 }).map((_, index) => (
              <Skeleton key={index} className="h-14 w-20 shrink-0 rounded-lg sm:h-16 sm:w-24" />
            ))}
          </div>
        </div>
      </div>
      <MarketingEditorInspectorSkeleton rows={4} />
    </div>
  );
}

function CalendarEditorBodySkeleton() {
  return (
    <div className="flex min-h-0 flex-1 overflow-hidden" aria-hidden>
      <MarketingEditorRailSkeleton labels={['Layouts', 'Show', 'Style', 'AI']} />
      <div className="flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden">
        <div className="flex flex-wrap items-center justify-between gap-2 px-3 py-2 sm:px-4">
          <Skeleton className="h-9 w-36 rounded-lg" />
          <div className="flex items-center gap-2">
            <Skeleton className="hidden h-9 w-48 rounded-lg lg:block" />
            <Skeleton className="h-9 w-20 rounded-lg" />
          </div>
        </div>
        <div className="bg-muted/20 flex min-h-0 flex-1 items-center justify-center overflow-hidden p-4 sm:p-6">
          <Skeleton className="aspect-[4/5] h-full max-h-[min(100%,42rem)] w-auto max-w-full rounded-xl" />
        </div>
      </div>
    </div>
  );
}

/**
 * Open-editor skeleton. Matches the real editor chrome per tab: top bar, 72px rail,
 * left panel (design / video), inspector (video), canvas + timeline, mobile dock.
 */
const EDITOR_BACK_LABEL: Record<'design' | 'video' | 'calendar', string> = {
  design: 'Posts',
  video: 'Videos',
  calendar: 'Calendar',
};

const EDITOR_DOCK_LABELS: Record<'design' | 'video' | 'calendar', string[]> = {
  design: ['Templates', 'AI'],
  video: ['Media', 'Text', 'Edit', 'Templates'],
  calendar: ['Layouts', 'Show', 'Style', 'AI'],
};

export function MarketingEditorSkeleton({
  variant = 'design',
  backLabel,
}: {
  variant?: 'design' | 'video' | 'calendar';
  backLabel?: string;
} = {}) {
  return (
    <div
      role="status"
      className="flex min-h-0 flex-1 flex-col overflow-hidden"
      aria-busy="true"
      aria-label="Loading editor"
    >
      <MarketingEditorTopBarSkeleton backLabel={backLabel ?? EDITOR_BACK_LABEL[variant]} />
      {variant === 'video' ? (
        <VideoEditorBodySkeleton />
      ) : variant === 'calendar' ? (
        <CalendarEditorBodySkeleton />
      ) : (
        <DesignEditorBodySkeleton />
      )}
      <MarketingEditorMobileDockSkeleton labels={EDITOR_DOCK_LABELS[variant]} />
    </div>
  );
}

/** Themes home: heading, New theme tile, then saved theme cards. */
export function MarketingThemesHomeSkeleton() {
  return (
    <div
      role="status"
      className="min-h-0 flex-1 overflow-y-auto"
      aria-busy="true"
      aria-label="Loading themes"
    >
      <div className="mx-auto max-w-6xl space-y-4 p-3 sm:p-4 lg:p-6">
        <div className="space-y-1.5" aria-hidden>
          <h2 className="text-section-title font-semibold">Themes</h2>
          <p className="text-muted-foreground text-xs sm:text-sm">
            Everything you make in a theme uses its colors and fonts.
          </p>
        </div>
        <ul className="grid grid-cols-1 gap-3 sm:grid-cols-2 sm:gap-4 xl:grid-cols-3">
          <li className="min-h-[9rem]" aria-hidden>
            <div className="border-border flex min-h-[9rem] flex-col items-center justify-center gap-2 rounded-xl border-2 border-dashed p-4 text-center">
              <Skeleton className="size-10 rounded-full" />
              <span className="text-foreground text-sm font-medium">New theme</span>
              <span className="text-muted-foreground text-xs">
                Start from a look or describe one
              </span>
            </div>
          </li>
          {Array.from({ length: 3 }).map((_, index) => (
            <li key={index} aria-hidden>
              <div className="border-border bg-card overflow-hidden rounded-xl border">
                <Skeleton className="aspect-[16/9] w-full rounded-none" />
                <div className="min-h-[52px] px-3 py-2">
                  <Skeleton className="h-5 w-2/3" />
                  <Skeleton className="h-4 w-16" />
                </div>
              </div>
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}

/** Recent publishes list (history view inside a Library / AI Studio tab). */
export function MarketingPublishHistorySkeleton() {
  return (
    <section
      role="status"
      className="space-y-3"
      aria-busy="true"
      aria-label="Loading recent publishes"
    >
      <div className="flex min-h-11 items-center gap-1" aria-hidden>
        <Skeleton className="h-9 w-16 rounded-md" />
        <Skeleton className="h-5 w-px" />
        <h2 className="text-section-title min-w-0 truncate">Recent publishes</h2>
        <Skeleton className="ml-auto h-3 w-20" />
      </div>
      <ul className="space-y-2">
        {Array.from({ length: 4 }).map((_, index) => (
          <li
            key={index}
            className="border-border flex items-center justify-between gap-3 rounded-xl border px-3 py-2.5"
            style={{ opacity: 1 - index * 0.06 }}
          >
            <div className="min-w-0 flex-1 space-y-1.5">
              <Skeleton className="h-3.5 w-36" />
              <Skeleton className="h-3 w-52 max-w-full" />
            </div>
            <Skeleton className="h-5 w-16 shrink-0 rounded-full" />
          </li>
        ))}
      </ul>
    </section>
  );
}

/** AI Studio conversation: top bar, thread + refine column, preview stage, mobile versions. */
export function MarketingAiStudioConversationSkeleton() {
  return (
    <div
      role="status"
      className="flex min-h-0 flex-1 flex-col overflow-hidden"
      aria-busy="true"
      aria-label="Loading AI creation"
    >
      <MarketingEditorTopBarSkeleton backLabel="AI Studio" />

      <div className="hidden min-h-0 flex-1 grid-cols-[minmax(20rem,22.5rem)_minmax(0,1fr)] lg:grid">
        <aside className="border-border flex min-h-0 flex-col border-r" aria-hidden>
          <div className="min-h-0 flex-1 space-y-3 overflow-hidden p-4">
            {Array.from({ length: 4 }).map((_, index) => (
              <div
                key={index}
                className={cn('flex', index % 2 === 0 ? 'justify-start' : 'justify-end')}
              >
                <Skeleton
                  className="h-14 rounded-xl"
                  style={{ width: `${55 + (index % 3) * 12}%`, opacity: 1 - index * 0.06 }}
                />
              </div>
            ))}
          </div>
          <div className="border-border border-t p-3">
            <Skeleton className="h-24 w-full rounded-xl" />
          </div>
        </aside>
        <section className="bg-muted/40 flex min-h-0 flex-col p-4" aria-hidden>
          <Skeleton className="min-h-[16rem] w-full flex-1 rounded-xl" />
        </section>
      </div>

      <div className="flex min-h-0 flex-1 flex-col lg:hidden">
        <div className="bg-muted/40 flex min-h-0 flex-1 flex-col p-3" aria-hidden>
          <Skeleton className="min-h-[14rem] w-full flex-1 rounded-xl" />
        </div>
        <div className="border-border space-y-2 border-t p-3" aria-hidden>
          <div className="flex items-center gap-2">
            <div className="flex min-w-0 flex-1 gap-2 overflow-hidden">
              {Array.from({ length: 4 }).map((_, index) => (
                <Skeleton key={index} className="h-16 w-12 shrink-0 rounded-lg" />
              ))}
            </div>
            <Skeleton className="h-11 w-20 shrink-0 rounded-lg" />
          </div>
          <Skeleton className="h-24 w-full rounded-xl" />
        </div>
      </div>
    </div>
  );
}

/** Theme library card (`MarketingThemeCardSkeleton`) used inline by ThemesHome. */
export function MarketingThemeCardSkeleton() {
  return (
    <div className="border-border overflow-hidden rounded-xl border">
      <Skeleton className="aspect-[16/9] w-full rounded-none" />
      <div className="min-h-[52px] px-3 py-2">
        <Skeleton className="h-5 w-2/3" />
        <Skeleton className="h-4 w-16" />
      </div>
    </div>
  );
}

/** Default marketing body (library). Route chrome wraps this separately. */
export function MarketingStudioSkeleton() {
  return <MarketingLibraryBodySkeleton />;
}
