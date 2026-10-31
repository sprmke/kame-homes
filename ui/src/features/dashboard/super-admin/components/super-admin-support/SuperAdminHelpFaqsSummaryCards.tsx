import { BookOpen, Eye, EyeOff, FolderOpen } from 'lucide-react';

import { AdminMetricCard } from '@/features/dashboard/bookings/components/AdminMetricCard';
import type { AdminHelpCenterFaq } from '@/features/dashboard/super-admin/hooks/useHelpCenterFaqsAdmin';

type Props = {
  faqs: AdminHelpCenterFaq[];
};

export function superAdminHelpFaqsSummaryFromList(faqs: AdminHelpCenterFaq[]) {
  const published = faqs.filter((faq) => faq.is_published).length;
  const unpublished = faqs.length - published;
  const categories = new Set(faqs.map((faq) => faq.category)).size;

  return { total: faqs.length, published, unpublished, categories };
}

export function SuperAdminHelpFaqsSummaryCards({ faqs }: Props) {
  const summary = superAdminHelpFaqsSummaryFromList(faqs);

  return (
    <section
      aria-label="FAQ summary"
      className="grid grid-cols-2 gap-2.5 sm:gap-3 lg:grid-cols-4 lg:gap-4"
    >
      <AdminMetricCard
        title="Total FAQs"
        value={String(summary.total)}
        icon={BookOpen}
        iconClassName="text-sky-600 dark:text-sky-400"
        iconBgClassName="bg-sky-100 dark:bg-sky-900/30"
      />
      <AdminMetricCard
        title="Published"
        value={String(summary.published)}
        icon={Eye}
        iconClassName="text-emerald-600 dark:text-emerald-400"
        iconBgClassName="bg-emerald-100 dark:bg-emerald-900/30"
      />
      <AdminMetricCard
        title="Unpublished"
        value={String(summary.unpublished)}
        icon={EyeOff}
        iconClassName="text-amber-600 dark:text-amber-400"
        iconBgClassName="bg-amber-100 dark:bg-amber-900/30"
      />
      <AdminMetricCard
        title="Categories"
        value={String(summary.categories)}
        icon={FolderOpen}
        iconClassName="text-violet-600 dark:text-violet-400"
        iconBgClassName="bg-violet-100 dark:bg-violet-900/30"
      />
    </section>
  );
}
