import type { ReactNode } from 'react';

import type { SetupGuideStepKind } from '@/features/dashboard/setup-guide/lib/setupGuideTypes';

import { Card, CardContent, CardHeader } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { cn } from '@/lib/utils';

/** Loading shape for one Setup Guide step. Mirrors that step's form, not the settings page nav. */
export function SetupGuideStepSkeleton({ kind }: { kind?: SetupGuideStepKind }) {
  return (
    <div className="flex flex-col gap-3" aria-busy="true" aria-label="Loading setup step">
      {renderStepSkeleton(kind)}
    </div>
  );
}

function renderStepSkeleton(kind: SetupGuideStepKind | undefined): ReactNode {
  switch (kind) {
    case 'welcome':
    case 'org.done':
      return <MomentSkeleton />;
    case 'org.brand':
      return <OrgBrandSkeleton />;
    case 'property.basics':
      return <PropertyBasicsSkeleton />;
    case 'property.location':
      return (
        <SectionShell>
          <LocationFields />
        </SectionShell>
      );
    case 'parking.location':
      return <LocationFields />;
    case 'property.content':
      return <PropertyContentSkeleton />;
    case 'property.pricing':
    case 'parking.pricing':
      return <PricingSkeleton />;
    case 'property.payments':
      return (
        <SectionShell>
          <PaymentMethodCard />
        </SectionShell>
      );
    case 'parking.payments':
      return <PaymentMethodCard />;
    case 'property.guestform':
      return <GuestFormSkeleton />;
    case 'property.email':
      return <PropertyEmailSkeleton />;
    case 'parking.basics':
      return <ParkingBasicsSkeleton />;
    case 'parking.photo':
      return <ParkingPhotoSkeleton />;
    case 'parking.email':
      return <ParkingEmailSkeleton />;
    case 'org.verification':
      return <VerificationSkeleton slots={2} />;
    case 'org.recommended':
      return <VerificationSkeleton slots={3} />;
    case 'org.team':
      return <TeamSkeleton />;
    default:
      return (
        <SectionShell>
          <Field />
          <FieldGrid>
            <Field />
            <Field />
          </FieldGrid>
        </SectionShell>
      );
  }
}

function SectionShell({
  children,
  description = true,
  dense = false,
}: {
  children: ReactNode;
  description?: boolean;
  dense?: boolean;
}) {
  return (
    <Card>
      <CardHeader className={cn(dense && 'space-y-1 p-3 sm:space-y-1 sm:p-4')}>
        <div className="flex items-center gap-2">
          <Skeleton className="size-4 shrink-0 rounded" />
          <Skeleton className="h-4 w-36" />
        </div>
        {description ? <Skeleton className="h-3 w-full max-w-xs" /> : null}
      </CardHeader>
      <CardContent
        className={cn(
          dense ? 'space-y-3 p-3 pt-0 sm:space-y-4 sm:p-4 sm:pt-0' : 'space-y-3 sm:space-y-6'
        )}
      >
        {children}
      </CardContent>
    </Card>
  );
}

function Field({
  labelClassName = 'w-28',
  control,
}: {
  labelClassName?: string;
  control?: ReactNode;
}) {
  return (
    <div className="space-y-2">
      <Skeleton className={cn('h-3.5', labelClassName)} />
      {control ?? <Skeleton className="h-10 w-full rounded-md" />}
    </div>
  );
}

function FieldGrid({ children, columns = '2' }: { children: ReactNode; columns?: '2' | '3' }) {
  return (
    <div
      className={cn(
        'grid grid-cols-1 gap-4',
        columns === '3' ? 'sm:grid-cols-2 md:grid-cols-3' : 'sm:grid-cols-2 sm:gap-x-5'
      )}
    >
      {children}
    </div>
  );
}

function SlugField() {
  return (
    <div className="space-y-2">
      <Skeleton className="h-3.5 w-20" />
      <div className="flex min-w-0 flex-col gap-2 sm:flex-row sm:items-center">
        <Skeleton className="h-4 w-full max-w-[16rem]" />
        <Skeleton className="h-10 w-full rounded-md sm:max-w-xs" />
      </div>
    </div>
  );
}

function BrandSwatches({ includePhoto = false }: { includePhoto?: boolean }) {
  const count = includePhoto ? 13 : 12;
  return (
    <div className="space-y-2">
      <Skeleton className="h-3.5 w-24" />
      <div className="flex flex-wrap items-center gap-2">
        {Array.from({ length: count }).map((_, index) => (
          <Skeleton key={index} className="size-11 shrink-0 rounded-full" />
        ))}
        <Skeleton className="h-8 w-16 rounded-md" />
      </div>
    </div>
  );
}

function TextBlock({ className }: { className: string }) {
  return (
    <div className="space-y-2">
      <Skeleton className="h-3.5 w-24" />
      <Skeleton className={cn('w-full rounded-md', className)} />
    </div>
  );
}

function PropertyBasicsSkeleton() {
  return (
    <>
      <SectionShell>
        <Field labelClassName="w-32" />
        <SlugField />
        <BrandSwatches includePhoto />
        <FieldGrid>
          <Field labelClassName="w-28" />
          <Field labelClassName="w-24" />
          <Field labelClassName="w-16" />
          <Field labelClassName="w-12" />
        </FieldGrid>
        <TextBlock className="h-48" />
      </SectionShell>
      <SectionShell>
        <FieldGrid columns="3">
          {Array.from({ length: 6 }).map((_, index) => (
            <Field key={index} labelClassName="w-20" />
          ))}
        </FieldGrid>
        <div className="flex items-start gap-3">
          <Skeleton className="mt-0.5 size-4 shrink-0 rounded" />
          <div className="min-w-0 flex-1 space-y-2">
            <Skeleton className="h-4 w-40" />
            <Skeleton className="h-3 w-full max-w-md" />
          </div>
        </div>
      </SectionShell>
    </>
  );
}

function OrgBrandSkeleton() {
  return (
    <>
      <SectionShell>
        <Field
          labelClassName="w-36"
          control={<Skeleton className="size-40 rounded-xl sm:size-44" />}
        />
        <Field labelClassName="w-36" />
        <SlugField />
        <BrandSwatches />
        <Field labelClassName="w-16" />
        <TextBlock className="h-36" />
      </SectionShell>
      <SectionShell description={false}>
        <Skeleton className="h-3 w-56 max-w-full" />
        <div className="border-border/60 divide-border/50 divide-y overflow-hidden rounded-xl border">
          {Array.from({ length: 4 }).map((_, index) => (
            <div key={index} className="flex items-center gap-3 px-3 py-3">
              <Skeleton className="h-3.5 w-20 shrink-0" />
              <Skeleton className="h-10 min-w-0 flex-1 rounded-md" />
            </div>
          ))}
        </div>
      </SectionShell>
    </>
  );
}

function LocationFields() {
  return (
    <div className="space-y-4">
      <Field labelClassName="w-20" />
      <div className="space-y-2">
        <Skeleton className="h-3.5 w-16" />
        <Skeleton className="aspect-video w-full rounded-lg" />
      </div>
    </div>
  );
}

function PropertyContentSkeleton() {
  return (
    <>
      <SectionShell>
        <div className="grid grid-cols-2 gap-2.5 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 lg:gap-3">
          {Array.from({ length: 5 }).map((_, index) => (
            <Skeleton key={index} className="aspect-square w-full rounded-xl" />
          ))}
        </div>
      </SectionShell>
      <SectionShell>
        <ChipRow count={8} />
      </SectionShell>
      <SectionShell>
        <ChipRow count={6} />
      </SectionShell>
      <SectionShell>
        {Array.from({ length: 3 }).map((_, index) => (
          <div key={index} className="flex items-center gap-3">
            <Skeleton className="size-4 shrink-0 rounded-full" />
            <Skeleton className="h-4 w-40" />
          </div>
        ))}
      </SectionShell>
    </>
  );
}

function ChipRow({ count }: { count: number }) {
  return (
    <div className="flex flex-wrap gap-2">
      {Array.from({ length: count }).map((_, index) => (
        <Skeleton
          key={index}
          className="h-9 rounded-full"
          style={{ width: `${4.5 + (index % 3) * 1.25}rem` }}
        />
      ))}
    </div>
  );
}

function PricingSkeleton() {
  return (
    <section className="surface-card space-y-5 p-4 sm:p-5">
      <div className="space-y-3">
        <Skeleton className="h-4 w-24" />
        <Field labelClassName="w-32" />
        <Field labelClassName="w-28" />
      </div>
      <div className="border-border/60 border-t" />
      <div className="space-y-3">
        <Skeleton className="h-4 w-12" />
        {Array.from({ length: 4 }).map((_, index) => (
          <Field key={index} labelClassName="w-36" />
        ))}
      </div>
    </section>
  );
}

function PaymentMethodCard() {
  return (
    <article className="border-border/60 bg-card overflow-hidden rounded-xl border">
      <div className="border-border/50 flex items-center gap-3 border-b px-3 py-3 sm:px-4">
        <Skeleton className="size-11 shrink-0 rounded-xl" />
        <Skeleton className="h-4 w-28" />
        <Skeleton className="ml-auto h-5 w-16 rounded-full" />
      </div>
      <div className="grid grid-cols-1 gap-4 px-3 py-4 sm:grid-cols-2 sm:px-4">
        <div className="sm:col-span-2">
          <Field labelClassName="w-20" />
        </div>
        <Field labelClassName="w-28" />
        <Field labelClassName="w-32" />
        <div className="space-y-2 sm:col-span-2">
          <Skeleton className="h-3.5 w-16" />
          <Skeleton className="aspect-square w-full max-w-[10rem] rounded-xl" />
        </div>
      </div>
    </article>
  );
}

function GuestFormSkeleton() {
  return (
    <>
      <SectionShell>
        {Array.from({ length: 4 }).map((_, index) => (
          <div key={index} className="flex min-h-11 items-center justify-between gap-3">
            <div className="min-w-0 flex-1 space-y-1.5">
              <Skeleton className="h-4 w-28" />
              <Skeleton className="h-3 w-40 max-w-full" />
            </div>
            <Skeleton className="h-6 w-11 shrink-0 rounded-full" />
          </div>
        ))}
        <Field labelClassName="w-40" />
      </SectionShell>
      <SectionShell>
        <FieldGrid>
          <Field />
          <Field />
          <Field />
          <Field />
        </FieldGrid>
        <div className="space-y-2">
          <Skeleton className="h-3.5 w-24" />
          <Skeleton className="h-24 w-full max-w-xs rounded-xl" />
        </div>
      </SectionShell>
    </>
  );
}

function PropertyEmailSkeleton() {
  return (
    <SectionShell>
      <div className="space-y-3">
        <Skeleton className="h-4 w-24" />
        <Skeleton className="h-3 w-56 max-w-full" />
        <FieldGrid>
          <Field labelClassName="w-28" />
          <Field labelClassName="w-32" />
        </FieldGrid>
      </div>
      <div className="space-y-3">
        <Skeleton className="h-4 w-40" />
        <FieldGrid>
          <Field labelClassName="w-24" />
          <Field labelClassName="w-28" />
        </FieldGrid>
      </div>
      <div className="bg-muted/40 flex min-h-11 items-center justify-between gap-3 rounded-lg border px-3 py-2.5">
        <Skeleton className="h-4 w-48 max-w-[70%]" />
        <Skeleton className="h-8 w-20 rounded-md" />
      </div>
    </SectionShell>
  );
}

function ParkingBasicsSkeleton() {
  return (
    <>
      <BrandSwatches includePhoto />
      <TextBlock className="h-20" />
      <SectionShell dense>
        <div className="space-y-2">
          <Skeleton className="h-3.5 w-40" />
          <div className="grid gap-2 sm:grid-cols-2">
            <Skeleton className="h-11 w-full rounded-xl" />
            <Skeleton className="h-11 w-full rounded-xl" />
          </div>
        </div>
        <FieldGrid columns="3">
          <Field labelClassName="w-20" />
          <Field labelClassName="w-20" />
          <Field labelClassName="w-16" />
        </FieldGrid>
      </SectionShell>
    </>
  );
}

function ParkingPhotoSkeleton() {
  return (
    <>
      <Skeleton className="aspect-[16/10] w-full rounded-xl sm:aspect-[2/1]" />
      <SectionShell>
        <ChipRow count={8} />
      </SectionShell>
    </>
  );
}

function ParkingEmailSkeleton() {
  return (
    <>
      <div className="space-y-3">
        {Array.from({ length: 3 }).map((_, index) => (
          <div key={index} className="flex min-h-11 items-center justify-between gap-4">
            <Skeleton className="h-4 w-40" />
            <Skeleton className="h-6 w-11 shrink-0 rounded-full" />
          </div>
        ))}
      </div>
      <div className="flex min-h-11 items-center justify-between gap-4">
        <Skeleton className="h-4 w-36" />
        <Skeleton className="h-6 w-11 shrink-0 rounded-full" />
      </div>
    </>
  );
}

function VerificationSkeleton({ slots }: { slots: number }) {
  return (
    <div className="border-border space-y-4 rounded-xl border p-3 sm:p-4">
      <div className="space-y-1.5">
        <Skeleton className="h-4 w-36" />
        <Skeleton className="h-3 w-full max-w-sm" />
      </div>
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        {Array.from({ length: slots }).map((_, index) => (
          <div key={index} className="space-y-2">
            <Skeleton className="h-3.5 w-28" />
            <Skeleton className="aspect-[4/3] w-full rounded-xl" />
          </div>
        ))}
      </div>
    </div>
  );
}

function TeamSkeleton() {
  return (
    <div className="flex flex-col gap-4">
      <section className="surface-card space-y-4 p-4 sm:p-5">
        <Skeleton className="h-4 w-28" />
        <Field labelClassName="w-12" />
        <Field labelClassName="w-14" />
        <Field labelClassName="w-12" />
        <Skeleton className="h-11 w-full rounded-md sm:w-32" />
      </section>
      <section className="surface-card space-y-3 p-4 sm:p-5">
        <Skeleton className="h-4 w-16" />
        {Array.from({ length: 3 }).map((_, index) => (
          <div key={index} className="flex items-center justify-between gap-2">
            <Skeleton className="h-4 w-40 max-w-[70%]" />
            <Skeleton className="h-3 w-16" />
          </div>
        ))}
      </section>
    </div>
  );
}

function MomentSkeleton() {
  return (
    <div className="flex flex-col items-center px-1 py-6 sm:py-10">
      <Skeleton className="size-20 rounded-full" />
      <Skeleton className="mt-5 h-7 w-36" />
      <div className="mt-3 w-full max-w-[26rem] space-y-2">
        <Skeleton className="mx-auto h-3.5 w-full" />
        <Skeleton className="mx-auto h-3.5 w-4/5" />
      </div>
      <div className="mt-6 grid w-full max-w-md grid-cols-2 gap-2">
        {Array.from({ length: 4 }).map((_, index) => (
          <Skeleton key={index} className="h-11 w-full rounded-xl" />
        ))}
      </div>
    </div>
  );
}
